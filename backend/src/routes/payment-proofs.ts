import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess, sendPaginated } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendNotification } from '../lib/notifications';
import { recordSuccessfulPayment } from '../lib/payment-processing';
import {
  PAYMENT_PROOF_UPLOAD_DIR,
  formatPaymentProof,
  hasAmountMismatch,
  isLegacyLocalScreenshot,
  paymentProofInclude,
} from '../lib/payment-proofs';
import { getStorageProvider } from '../lib/storage';
import { RejectPaymentProofSchema, PaymentProofStatusValues } from '@apartment/shared';
import type { PaymentProofResponse } from '@apartment/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Manual payment proof review (ADR 008) - admin side.
//
// Approving reuses the existing mark-invoice-paid logic (a Payment row plus
// recordSuccessfulPayment), so an approved proof lands the invoice in exactly
// the same state a gateway payment would. Rejecting leaves the invoice unpaid so
// the resident can resubmit. Both are race-safe atomic claims from PENDING.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

type ProofWithRelations = Prisma.PaymentProofGetPayload<{ include: typeof paymentProofInclude }>;

/** Load a proof inside the caller's society, or 404. */
async function findProof(id: string, societyId: string): Promise<ProofWithRelations> {
  const proof = await prisma.paymentProof.findFirst({
    where: { id, societyId, deletedAt: null },
    include: paymentProofInclude,
  });
  if (!proof) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Payment proof not found');
  return proof;
}

// ── GET /api/v1/payment-proofs?status=PENDING ──────────────────────────────
// The review queue. Defaults to PENDING (what actually needs a decision); pass
// ?status=APPROVED|REJECTED|ALL to look back. Cursor paginated like every other
// list endpoint, and always scoped to the caller's society.
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'payment_proof'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const status = (req.query.status as string | undefined)?.toUpperCase() || 'PENDING';
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (status !== 'ALL' && !(PaymentProofStatusValues as readonly string[]).includes(status)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `status must be one of ${PaymentProofStatusValues.join(', ')} or ALL`
        );
      }

      const where: Prisma.PaymentProofWhereInput = { societyId, deletedAt: null };
      if (status !== 'ALL') where.status = status as PaymentProofResponse['status'];
      if (cursor) where.createdAt = { lt: new Date(cursor) };

      const proofs = await prisma.paymentProof.findMany({
        where,
        include: paymentProofInclude,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = proofs.length > limit;
      const data = proofs.slice(0, limit).map(formatPaymentProof);
      const nextCursor = hasMore ? data[data.length - 1].createdAt : null;
      sendPaginated(res, data, nextCursor);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/payment-proofs/:id/screenshot ──────────────────────────────
// Access-controlled screenshot delivery. Unlike ticket/parcel photos (public
// Cloudinary URLs), this is financial evidence: only admins of the same society
// or the resident who submitted it may read it.
//
// The bytes are streamed through the API rather than redirecting to Cloudinary:
// the live account serves uploaded assets from their plain delivery URL to
// anyone who has it (verified - even `type: authenticated` assets answered 200
// without a signature), so handing the browser a provider URL would quietly
// break the access rule this route exists to enforce.
router.get('/:id/screenshot', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const proof = await prisma.paymentProof.findFirst({
      where: { id: req.params.id, societyId, deletedAt: null },
      select: { id: true, residentId: true, screenshotUrl: true },
    });
    if (!proof) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Payment proof not found');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && proof.residentId !== req.user!.id) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    }

    // Proofs submitted before the Cloudinary move stored a bare filename on local
    // disk. Keep serving those so existing rows do not break.
    if (isLegacyLocalScreenshot(proof.screenshotUrl)) {
      if (!/^[a-zA-Z0-9._-]+$/.test(proof.screenshotUrl)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Invalid filename');
      }
      const filePath = path.join(PAYMENT_PROOF_UPLOAD_DIR, proof.screenshotUrl);
      if (!fs.existsSync(filePath)) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Screenshot not found on disk');
      }
      res.sendFile(filePath);
      return;
    }

    const { stream, contentType, contentLength } = await getStorageProvider().openAssetStream(
      proof.screenshotUrl
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/payment-proofs/:id/approve ────────────────────────────────
// Approve a proof: the invoice becomes paid (paymentSource: manual_proof) via
// the same logic a gateway payment uses, the resident is told, and everything is
// audit logged. The claimed amount is taken as paid as-is - a mismatch is the
// admin's call (it is surfaced on every proof), never auto-adjusted.
router.post(
  '/:id/approve',
  requireAuth,
  loadMembership,
  requireRole('update', 'payment_proof'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const proof = await findProof(req.params.id, societyId);

      if (proof.status !== 'PENDING') {
        throw new AppError(
          ErrorCodes.CONFLICT,
          409,
          `This proof was already ${proof.status.toLowerCase()} and cannot be reviewed again.`
        );
      }

      // Refuse to double-credit: if the invoice was paid in the meantime (e.g.
      // the resident also paid through Safepay), approving would add a second
      // payment and inflate the collected total. The admin should reject instead.
      if (proof.invoice.status === 'PAID') {
        throw new AppError(
          ErrorCodes.CONFLICT,
          409,
          'This invoice is already paid. Reject the proof if the payment it shows is not a second payment.'
        );
      }

      // Atomic claim: whoever wins the race reviews it, a second click is a 409.
      const claim = await prisma.paymentProof.updateMany({
        where: { id: proof.id, societyId, status: 'PENDING', deletedAt: null },
        data: { status: 'APPROVED', reviewedById: req.user!.id, reviewedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new AppError(ErrorCodes.CONFLICT, 409, 'This proof was already reviewed.');
      }

      const amountMismatch = hasAmountMismatch(proof);

      // Record the money exactly the way a gateway payment is recorded: a
      // Payment row, then the shared mark-invoice-paid logic. Linked by
      // paymentProofId (unique), so one proof can never produce two payments.
      const payment = await prisma.payment.create({
        data: {
          invoiceId: proof.invoiceId,
          societyId,
          amount: proof.claimedAmount,
          currency: 'PKR',
          provider: 'manual_proof',
          paymentProofId: proof.id,
          status: 'pending',
        },
      });

      await recordSuccessfulPayment({
        paymentId: payment.id,
        invoiceId: proof.invoiceId,
        societyId,
        amount: proof.claimedAmount,
        txnRef: proof.transactionReference,
        paymentSource: 'manual_proof',
        // The resident gets one specific PAYMENT_PROOF_APPROVED notification
        // below instead of a second generic PAYMENT_CONFIRMED one.
        notify: false,
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'PAYMENT_PROOF_APPROVED',
        entityType: 'payment_proof',
        entityId: proof.id,
        before: { status: 'PENDING' },
        after: {
          status: 'APPROVED',
          invoiceId: proof.invoiceId,
          invoiceNumber: proof.invoice.invoiceNumber,
          claimedAmount: proof.claimedAmount,
          paymentMethod: proof.paymentMethod,
          paymentId: payment.id,
          amountMismatch,
        },
      });

      await sendNotification({
        type: 'PAYMENT_PROOF_APPROVED',
        proofId: proof.id,
        invoiceId: proof.invoiceId,
        invoiceNumber: proof.invoice.invoiceNumber,
        societyId,
        residentId: proof.residentId,
        claimedAmount: proof.claimedAmount,
      });

      // Re-read so the response reflects the post-approval invoice state.
      const updated = await findProof(proof.id, societyId);
      sendSuccess(res, formatPaymentProof(updated));
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/payment-proofs/:id/reject ─────────────────────────────────
// Reject a proof. A reason is required (Zod-enforced) because the resident sees
// it and uses it to resubmit. The invoice stays exactly as it was.
router.post(
  '/:id/reject',
  requireAuth,
  loadMembership,
  requireRole('update', 'payment_proof'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const input = RejectPaymentProofSchema.parse(req.body);
      const proof = await findProof(req.params.id, societyId);

      if (proof.status !== 'PENDING') {
        throw new AppError(
          ErrorCodes.CONFLICT,
          409,
          `This proof was already ${proof.status.toLowerCase()} and cannot be reviewed again.`
        );
      }

      const claim = await prisma.paymentProof.updateMany({
        where: { id: proof.id, societyId, status: 'PENDING', deletedAt: null },
        data: {
          status: 'REJECTED',
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason,
        },
      });
      if (claim.count === 0) {
        throw new AppError(ErrorCodes.CONFLICT, 409, 'This proof was already reviewed.');
      }

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'PAYMENT_PROOF_REJECTED',
        entityType: 'payment_proof',
        entityId: proof.id,
        before: { status: 'PENDING' },
        after: {
          status: 'REJECTED',
          invoiceId: proof.invoiceId,
          invoiceNumber: proof.invoice.invoiceNumber,
          claimedAmount: proof.claimedAmount,
          rejectionReason: input.rejectionReason,
          // No payment is recorded on rejection - the invoice is untouched.
        },
      });

      await sendNotification({
        type: 'PAYMENT_PROOF_REJECTED',
        proofId: proof.id,
        invoiceId: proof.invoiceId,
        invoiceNumber: proof.invoice.invoiceNumber,
        societyId,
        residentId: proof.residentId,
        claimedAmount: proof.claimedAmount,
        rejectionReason: input.rejectionReason,
      });

      const updated = await findProof(proof.id, societyId);
      sendSuccess(res, formatPaymentProof(updated));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
