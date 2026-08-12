import { Router } from 'express';
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { getPaymentProvider } from '../lib/payment-provider';
import { recordSuccessfulPayment } from '../lib/payment-processing';
import { CreateInvoiceSchema, UpdateInvoiceSchema, DisputeInvoiceSchema } from '@apartment/shared';
import type { InvoiceResponse, PaymentResponse } from '@apartment/shared';

const router = Router();

const invoiceInclude = {
  unit: { select: { unitNumber: true } },
  payments: { select: { amount: true, status: true, paidAt: true } },
} as const;

type InvoiceWithUnit = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

/**
 * Get the unit IDs that a user belongs to in a given society.
 * Returns empty array if the user has no unit assignments.
 */
async function getUserUnitIds(userId: string, societyId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, societyId, status: 'ACTIVE', deletedAt: null, unitId: { not: null } },
    select: { unitId: true },
  });
  return memberships.map((m) => m.unitId).filter(Boolean) as string[];
}

function formatInvoice(i: InvoiceWithUnit): InvoiceResponse {
  const successfulPayments = i.payments.filter((p) => p.status === 'succeeded');
  const paidAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
  const lastPaid = successfulPayments.length > 0 ? successfulPayments[successfulPayments.length - 1].paidAt : null;
  return {
    id: i.id, societyId: i.societyId, unitId: i.unitId,
    unitNumber: i.unit.unitNumber, invoiceNumber: i.invoiceNumber,
    title: i.title, description: i.description, amount: i.amount,
    dueDate: i.dueDate.toISOString(),
    status: i.status as import('@apartment/shared').InvoiceStatus,
    periodStart: i.periodStart?.toISOString() ?? null,
    periodEnd: i.periodEnd?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString(),
    paidAmount: paidAmount > 0 ? paidAmount : undefined,
    paidAt: lastPaid?.toISOString() ?? null,
  };
}

// ── POST /api/v1/invoices ──────────────────────────────────────────────────
router.post('/', requireAuth, loadMembership, requireRole('create', 'invoice'), async (req, res, next) => {
  try {
    const input = CreateInvoiceSchema.parse(req.body);
    const societyId = req.membership!.societyId;

    // Verify unit belongs to this society
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, societyId } });
    if (!unit) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Unit not found in this society');

    // Generate invoice number: INV-YYYYMMDD-XXXX-XXXX
    // Count only active (non-deleted) invoices, plus a random suffix for uniqueness.
    const count = await prisma.invoice.count({ where: { societyId, deletedAt: null } });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(count + 1).padStart(4, '0');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, '0');
    const invoiceNumber = `INV-${dateStr}-${seq}-${suffix}`;

    const invoice = await prisma.invoice.create({
      data: {
        societyId, unitId: input.unitId, invoiceNumber,
        title: input.title, description: input.description || null,
        amount: input.amount, dueDate: new Date(input.dueDate),
        status: input.status === 'DRAFT' ? 'DRAFT' : 'ISSUED',
        periodStart: input.periodStart ? new Date(input.periodStart) : null,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
      },
      include: { unit: { select: { unitNumber: true } }, payments: { select: { amount: true, status: true, paidAt: true } } },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'INVOICE_CREATED',
      entityType: 'invoice', entityId: invoice.id,
      after: { invoiceNumber, title: invoice.title, amount: invoice.amount },
    });

    sendSuccess(res, formatInvoice(invoice as InvoiceWithUnit), 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/invoices ───────────────────────────────────────────────────
// For residents: filters invoices to only their assigned unit(s).
// If a resident has no unit assigned, returns an empty array (defensive).
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
    const status = req.query.status as string | undefined;
    const unitId = req.query.unitId as string | undefined;

    const where: any = { societyId, deletedAt: null };

    if (isAdmin) {
      // Admin: can optionally filter by unit
      if (unitId) where.unitId = unitId;
    } else {
      // Resident: scope to their assigned unit(s) via their actual memberships
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (unitIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      where.unitId = { in: unitIds };
    }

    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { unit: { select: { unitNumber: true } }, payments: { select: { amount: true, status: true, paidAt: true } } },
    });

    sendSuccess(res, invoices.map((i) => formatInvoice(i as InvoiceWithUnit)));
  } catch (err) { next(err); }
});

// ── GET /api/v1/invoices/:id ───────────────────────────────────────────────
router.get('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, societyId, deletedAt: null },
      include: { unit: { select: { unitNumber: true } }, payments: { select: { amount: true, status: true, paidAt: true } } },
    });
    if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invoice not found');

    if (!isAdmin) {
      const userUnitIds = await getUserUnitIds(req.user!.id, societyId);
      if (!userUnitIds.includes(invoice.unitId)) {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
      }
    }

    sendSuccess(res, formatInvoice(invoice as InvoiceWithUnit));
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/invoices/:id ─────────────────────────────────────────────
router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'invoice'), async (req, res, next) => {
  try {
    const input = UpdateInvoiceSchema.parse(req.body);
    const societyId = req.membership!.societyId;

    const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invoice not found');
    if (existing.status === 'PAID') throw new AppError(ErrorCodes.CONFLICT, 409, 'Cannot modify a paid invoice');

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.dueDate !== undefined) updateData.dueDate = new Date(input.dueDate);
    if (input.status !== undefined) updateData.status = input.status;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: updateData,
      include: { unit: { select: { unitNumber: true } }, payments: { select: { amount: true, status: true, paidAt: true } } },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'INVOICE_UPDATED',
      entityType: 'invoice', entityId: invoice.id,
      before: { status: existing.status }, after: { status: invoice.status },
    });

    sendSuccess(res, formatInvoice(invoice as InvoiceWithUnit));
  } catch (err) { next(err); }
});

// ── POST /api/v1/invoices/:id/dispute ──────────────────────────────────────
router.post('/:id/dispute', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const input = DisputeInvoiceSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invoice not found');

    // Check resident belongs to this invoice's unit
    const userUnitIds = await getUserUnitIds(req.user!.id, societyId);
    if (!userUnitIds.includes(invoice.unitId)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'You can only dispute invoices for your unit');
    }
    if (invoice.status === 'DISPUTED') throw new AppError(ErrorCodes.CONFLICT, 409, 'Invoice is already disputed');
    if (invoice.status === 'PAID') throw new AppError(ErrorCodes.CONFLICT, 409, 'Cannot dispute a paid invoice');

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'DISPUTED' },
      include: { unit: { select: { unitNumber: true } }, payments: { select: { amount: true, status: true, paidAt: true } } },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'INVOICE_DISPUTED',
      entityType: 'invoice', entityId: invoice.id,
      after: { reason: input.reason },
    });

    sendSuccess(res, formatInvoice(updated as InvoiceWithUnit));
  } catch (err) { next(err); }
});

// ── POST /api/v1/invoices/:id/pay ──────────────────────────────────────────
// Creates a Safepay hosted-checkout session; falls back to offline mode when
// no gateway keys are configured (dev/testing only).
router.post('/:id/pay', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, societyId, deletedAt: null },
      include: { unit: { select: { unitNumber: true } }, payments: { select: { amount: true, status: true, paidAt: true } } },
    });
    if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invoice not found');

    // Check resident belongs to this invoice's unit
    const userUnitIds = await getUserUnitIds(req.user!.id, societyId);
    if (!userUnitIds.includes(invoice.unitId)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    }
    if (invoice.status === 'PAID') throw new AppError(ErrorCodes.CONFLICT, 409, 'Invoice is already paid');
    if (invoice.status === 'DISPUTED') throw new AppError(ErrorCodes.CONFLICT, 409, 'Cannot pay a disputed invoice');

    const provider = getPaymentProvider();
    if (!provider.isConfigured()) {
      // No payment gateway configured — create an offline payment record (for dev/testing)
      const payment = await prisma.payment.create({
        data: { invoiceId: invoice.id, societyId, amount: invoice.amount, status: 'succeeded', paidAt: new Date() },
      });
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
      await logAudit({
        societyId, actorUserId: req.user!.id, action: 'PAYMENT_RECORDED',
        entityType: 'payment', entityId: payment.id,
        after: { invoiceId: invoice.id, amount: invoice.amount, method: 'offline' },
      });
      sendSuccess(res, { message: 'Payment recorded (offline mode)', invoice: formatInvoice(invoice as InvoiceWithUnit) });
      return;
    }

    // Prevent double-charging: at most one active Safepay session per invoice.
    const existingPending = await prisma.payment.findFirst({
      where: { invoiceId: invoice.id, societyId, provider: 'safepay', status: 'pending' },
    });
    if (existingPending) {
      throw new AppError(ErrorCodes.CONFLICT, 409, 'A payment for this invoice is already in progress. Wait for it to finish or contact support before trying again.');
    }

    // Payment gateway is configured — create a Safepay hosted-checkout session
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await provider.createCheckoutSession({
      invoiceId: invoice.id,
      title: invoice.title,
      amount: invoice.amount,
      redirectUrl: `${frontendBase}/dashboard/resident/invoices?success=1&invoice=${invoice.id}`,
      cancelUrl: `${frontendBase}/dashboard/resident/invoices?canceled=1&invoice=${invoice.id}`,
    });

    // Save the Safepay tracker as the session reference (used for webhook matching + idempotency)
    try {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id, societyId, amount: invoice.amount, currency: 'PKR',
          provider: 'safepay', providerSessionId: session.trackerToken, status: 'pending',
        },
      });
    } catch (err) {
      // The tracker already exists at Safepay; without a matching row the webhook
      // cannot reconcile it. Log loudly so operations can resolve the orphan.
      console.error(`[Safepay] Failed to persist payment row for invoice ${invoice.id}:`, err instanceof Error ? err.message : err);
      throw new AppError(ErrorCodes.INTERNAL_ERROR, 500, 'Payment could not be started — please try again');
    }

    sendSuccess(res, { url: session.url });
  } catch (err) { next(err); }
});

// ── POST /api/v1/invoices/:id/verify-payment ───────────────────────────────
// Fallback reconciliation: checks the latest pending Safepay session for this
// invoice directly with the gateway. The webhook remains the source of truth;
// this only catches cases where the webhook hasn't landed yet (e.g. closed tab).
router.post('/:id/verify-payment', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Invoice not found');

    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      const userUnitIds = await getUserUnitIds(req.user!.id, societyId);
      if (!userUnitIds.includes(invoice.unitId)) {
        throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
      }
    }

    if (invoice.status === 'PAID') {
      sendSuccess(res, { status: 'succeeded' });
      return;
    }

    const pending = await prisma.payment.findFirst({
      where: { invoiceId: invoice.id, societyId, provider: 'safepay', status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending || !pending.providerSessionId) {
      sendSuccess(res, { status: 'none' });
      return;
    }

    const status = await getPaymentProvider().verifyPayment(pending.providerSessionId);
    if (status === 'succeeded') {
      await recordSuccessfulPayment({
        paymentId: pending.id,
        invoiceId: invoice.id,
        societyId,
        amount: pending.amount,
        txnRef: pending.providerSessionId,
      });
    } else if (status === 'failed') {
      await prisma.payment.update({ where: { id: pending.id }, data: { status: 'failed' } });
    }
    sendSuccess(res, { status });
  } catch (err) { next(err); }
});

// ── GET /api/v1/invoices/payments/history ──────────────────────────────────
router.get('/payments/history', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';

    const where: any = { societyId };
    if (!isAdmin) {
      const unitIds = await getUserUnitIds(req.user!.id, societyId);
      if (unitIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      where.invoice = { unitId: { in: unitIds } };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { invoice: { select: { invoiceNumber: true, title: true, unitId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    sendSuccess(res, payments.map((p) => ({
      id: p.id, invoiceId: p.invoiceId, invoiceNumber: p.invoice.invoiceNumber,
      invoiceTitle: p.invoice.title, amount: p.amount, currency: p.currency,
      status: p.status, paidAt: p.paidAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString(),
      provider: p.provider ?? 'offline',
      providerSessionId: p.providerSessionId,
      providerTxnRef: p.providerTxnRef,
    })));
  } catch (err) { next(err); }
});

export default router;
