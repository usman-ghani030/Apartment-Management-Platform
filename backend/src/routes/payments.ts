import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import { getPaymentProvider } from '../lib/payment-provider';
import { recordSuccessfulPayment } from '../lib/payment-processing';

const router = Router();
const provider = getPaymentProvider();

// ── POST /api/v1/payments/webhook ───────────────────────────────────────────
// Public endpoint called by Safepay. Signature-verified; never trusts the
// client-side redirect. Responds 200 to acknowledge (Safepay retries otherwise).
router.post('/webhook', async (req, res) => {
  const rawBody: string | undefined = (req as any).rawBody;
  const signature = (req.headers['x-sfpy-signature'] as string) || (req.headers['x-safepay-signature'] as string) || '';

  if (!rawBody || !signature || !provider.verifyWebhookSignature(rawBody, signature)) {
    // Log minimal info only — never echo the payload back to the caller.
    console.warn(`[Safepay] Webhook rejected: missing/invalid signature (len=${rawBody?.length ?? 0})`);
    res.status(400).json({ data: null, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
    return;
  }

  let event;
  try {
    event = provider.parseWebhookEvent(JSON.parse(rawBody));
  } catch {
    console.warn('[Safepay] Webhook rejected: unparseable JSON body');
    res.status(400).json({ data: null, error: { code: 'INVALID_PAYLOAD', message: 'Invalid payload' } });
    return;
  }

  if (event.type === 'ignored' || !event.trackerToken) {
    // Acknowledge so Safepay stops retrying; nothing actionable in this event.
    res.status(200).json({ data: { received: true }, error: null });
    return;
  }

  const payment = await prisma.payment.findUnique({ where: { providerSessionId: event.trackerToken } });
  if (!payment) {
    console.warn(`[Safepay] Webhook for unknown tracker ${event.trackerToken.slice(0, 8)}… — acknowledged`);
    res.status(200).json({ data: { received: true }, error: null });
    return;
  }

  // Idempotency: already-terminal payments are acknowledged without reprocessing.
  if (payment.status !== 'pending') {
    res.status(200).json({ data: { received: true, status: payment.status }, error: null });
    return;
  }

  try {
    if (event.type === 'succeeded') {
      await recordSuccessfulPayment({
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        societyId: payment.societyId,
        amount: payment.amount,
        txnRef: event.txnRef ?? null,
      });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', providerTxnRef: event.txnRef ?? null },
      });
      await logAudit({
        societyId: payment.societyId,
        actorUserId: null,
        action: 'PAYMENT_FAILED',
        entityType: 'payment',
        entityId: payment.id,
        after: { invoiceId: payment.invoiceId, method: 'safepay' },
      });
    }
    res.status(200).json({ data: { received: true }, error: null });
  } catch (err) {
    console.error('[Safepay] Webhook processing failed:', err instanceof Error ? err.message : err);
    // 500 → Safepay retries the webhook.
    res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: 'Processing failed' } });
  }
});

// ── POST /api/v1/payments/:tracker/verify ───────────────────────────────────
// Fallback reconciliation: resident asks the gateway directly about a session's
// true status (never relies on the redirect alone). Idempotent.
router.post('/:tracker/verify', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const payment = await prisma.payment.findUnique({ where: { providerSessionId: req.params.tracker } });
    if (!payment || payment.societyId !== societyId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Payment session not found');
    }

    // Resident access: invoice must belong to one of their units.
    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      const invoice = await prisma.invoice.findFirst({ where: { id: payment.invoiceId, societyId } });
      const memberships = await prisma.membership.findMany({
        where: { userId: req.user!.id, societyId, status: 'ACTIVE', deletedAt: null, unitId: { not: null } },
        select: { unitId: true },
      });
      const unitIds = memberships.map((m) => m.unitId).filter(Boolean) as string[];
      if (!invoice || !unitIds.includes(invoice.unitId)) {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
      }
    }

    let status: 'succeeded' | 'failed' | 'unknown' | 'none' = 'none';
    if (payment.status === 'pending') {
      status = await provider.verifyPayment(req.params.tracker);
      if (status === 'succeeded') {
        await recordSuccessfulPayment({
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          societyId: payment.societyId,
          amount: payment.amount,
          txnRef: req.params.tracker,
        });
      } else if (status === 'failed') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
      }
    } else {
      status = payment.status === 'succeeded' ? 'succeeded' : 'failed';
    }

    sendSuccess(res, { status, tracker: req.params.tracker });
  } catch (err) {
    next(err);
  }
});

export default router;
