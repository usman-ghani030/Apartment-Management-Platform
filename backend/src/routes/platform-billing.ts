import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import {
  generatePlatformInvoices,
  markOverduePlatformInvoices,
  markPlatformInvoicePaid,
} from '../lib/platform-billing';
import {
  calculatePlatformFee,
  requiresCustomQuote,
  FREE_UNIT_THRESHOLD,
  PLATFORM_PRICING,
} from '../config/platform-pricing';
import { MarkPlatformInvoicePaidSchema } from '@apartment/shared';
import type {
  PlatformInvoiceResponse,
  PlatformCustomQuoteFlagResponse,
  PlatformBillingRunResult,
  PlatformOverdueResult,
  PlatformBandLine,
  PlatformBillingStatus,
} from '@apartment/shared';

/**
 * Platform Billing (Phase 9, ADR 006) — societies paying the PLATFORM.
 * Distinct from resident dues (/api/v1/invoices, Phase 2, Safepay).
 *
 * Authorization model:
 * - Committee Admins see ONLY their own society's platform invoices (read-only).
 * - Everything platform-ops (all societies, mark-paid, generation runs,
 *   custom-quote list) requires the caller to hold a SUPER_ADMIN membership
 *   role — checked server-side on every route, never trusted from the client.
 */

const router = Router();

type InvoiceWithSociety = {
  id: string;
  societyId: string;
  billingPeriod: string;
  unitCountSnapshot: number;
  calculationBreakdown: unknown;
  totalAmountPaisa: number;
  dueDate: Date;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  generatedAt: Date;
  paidAt: Date | null;
  society: { id: string; name: string };
  markedPaidBySuperAdmin?: { name: string } | null;
};

function toInvoiceResponse(invoice: InvoiceWithSociety): PlatformInvoiceResponse {
  return {
    id: invoice.id,
    societyId: invoice.societyId,
    societyName: invoice.society.name,
    billingPeriod: invoice.billingPeriod,
    unitCountSnapshot: invoice.unitCountSnapshot,
    breakdown: (invoice.calculationBreakdown ?? []) as PlatformBandLine[],
    totalAmountRupees: invoice.totalAmountPaisa / 100,
    totalAmountPaisa: invoice.totalAmountPaisa,
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status,
    generatedAt: invoice.generatedAt.toISOString(),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    markedPaidBySuperAdminName: invoice.markedPaidBySuperAdmin?.name ?? null,
  };
}

/** Assert the caller's active membership in this society is SUPER_ADMIN. */
function requireSuperAdminMembership(req: {
  membership?: { societyId: string; role: string } | null;
  user?: { id: string } | null;
}): { societyId: string; userId: string } {
  if (!req.membership || !req.user) {
    throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
  }
  if (req.membership.role !== 'SUPER_ADMIN') {
    // Deliberately identical shape/message to the generic forbidden error so
    // the endpoint's existence as a super-admin surface isn't a beacon.
    throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Super Admin role required for platform operations');
  }
  return { societyId: req.membership.societyId, userId: req.user.id };
}

// ── GET /api/v1/platform-billing/status ─────────────────────────────────
// Where the caller's society stands today: live unit count, free-tier /
// custom-quote flag, and the progressive fee it would pay if billed now.
// Every Committee Admin (free tier included) gets a meaningful page.
router.get(
  '/status',
  requireAuth,
  loadMembership,
  requireRole('read', 'platform_billing'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const society = await prisma.society.findUnique({
        where: { id: societyId },
        select: { name: true },
      });
      if (!society) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Society not found');
      }

      const unitCount = await prisma.unit.count({
        where: { societyId, deletedAt: null },
      });
      const calc = calculatePlatformFee(unitCount);

      const status: PlatformBillingStatus = {
        societyName: society.name,
        unitCount,
        freeUnitThreshold: FREE_UNIT_THRESHOLD,
        autoInvoiceCap: PLATFORM_PRICING.autoInvoiceCap,
        isFreeTier: unitCount <= FREE_UNIT_THRESHOLD,
        isCustomQuote: requiresCustomQuote(unitCount),
        estimatedTotalRupees: calc.totalRupees,
        estimatedBreakdown: calc.breakdown,
      };

      sendSuccess(res, status);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/platform-billing ────────────────────────────────────────────
// Committee Admin (and Super Admin) view: their OWN society's platform invoice
// history. Read-only — there is no self-service "I paid" action anywhere.
router.get(
  '/',
  requireAuth,
  loadMembership,
  requireRole('read', 'platform_billing'),
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const invoices = await prisma.platformInvoice.findMany({
        where: { societyId, deletedAt: null },
        orderBy: { billingPeriod: 'desc' },
        include: {
          society: { select: { id: true, name: true } },
          markedPaidBySuperAdmin: { select: { name: true } },
        } as any,
      });

      sendSuccess(res, invoices.map((i) => toInvoiceResponse(i as unknown as InvoiceWithSociety)));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/platform-billing/all (SUPER_ADMIN only) ─────────────────────
// Platform-ops view: every society's platform invoices, newest period first.
router.get(
  '/all',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      requireSuperAdminMembership(req);

      const invoices = await prisma.platformInvoice.findMany({
        where: { deletedAt: null },
        orderBy: [{ billingPeriod: 'desc' }, { societyId: 'asc' }],
        include: {
          society: { select: { id: true, name: true } },
          markedPaidBySuperAdmin: { select: { name: true } },
        } as any,
      });

      sendSuccess(res, invoices.map((i) => toInvoiceResponse(i as unknown as InvoiceWithSociety)));
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/platform-billing/custom-quotes (SUPER_ADMIN only) ────────────
// Societies flagged for a manual custom-quote conversation (501+ units).
router.get(
  '/custom-quotes',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      requireSuperAdminMembership(req);

      const flags = await prisma.platformCustomQuoteFlag.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { society: { select: { id: true, name: true } } },
      });

      const response: PlatformCustomQuoteFlagResponse[] = flags.map((f) => ({
        id: f.id,
        societyId: f.societyId,
        societyName: f.society.name,
        billingPeriod: f.billingPeriod,
        unitCountSnapshot: f.unitCountSnapshot,
        note: f.note,
        resolvedAt: f.resolvedAt ? f.resolvedAt.toISOString() : null,
        createdAt: f.createdAt.toISOString(),
      }));

      sendSuccess(res, response);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/platform-billing/run-generation (SUPER_ADMIN only) ──────────
// Manual trigger for the monthly job — supports dryRun for first-run testing
// so no incorrect invoices are generated for real societies on day one.
const RunGenerationSchema = z.object({
  dryRun: z.boolean().optional().default(false),
});

router.post(
  '/run-generation',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const { societyId, userId } = requireSuperAdminMembership(req);
      const input = RunGenerationSchema.parse(req.body ?? {});

      const result: PlatformBillingRunResult = {
        dryRun: input.dryRun,
        ...(await generatePlatformInvoices(new Date(), {
          dryRun: input.dryRun,
        })),
      };

      await logAudit({
        societyId,
        actorUserId: userId,
        action: 'PLATFORM_BILLING_MANUALLY_RUN',
        entityType: 'platform_invoice',
        entityId: societyId,
        after: {
          dryRun: input.dryRun,
          created: result.created,
          skippedFree: result.skippedFree,
          customQuoteFlags: result.customQuoteFlags,
          errors: result.errors.length,
        },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/platform-billing/run-overdue-check (SUPER_ADMIN only) ───────
// Manual trigger for the daily overdue sweep (mark + reminder emails).
router.post(
  '/run-overdue-check',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const { societyId, userId } = requireSuperAdminMembership(req);

      const result: PlatformOverdueResult = await markOverduePlatformInvoices(new Date());

      await logAudit({
        societyId,
        actorUserId: userId,
        action: 'PLATFORM_OVERDUE_CHECK_MANUALLY_RUN',
        entityType: 'platform_invoice',
        entityId: societyId,
        after: {
          markedOverdue: result.markedOverdue,
          remindersSent: result.remindersSent,
          errors: result.errors.length,
        },
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/v1/platform-billing/:id/mark-paid (SUPER_ADMIN only) ──────────
// The ONLY way an invoice becomes PAID. Records paidAt + the acting Super
// Admin and writes an audit entry.
router.patch(
  '/:id/mark-paid',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const { userId } = requireSuperAdminMembership(req);

      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const input = MarkPlatformInvoicePaidSchema.parse(req.body ?? {});

      const outcome = await markPlatformInvoicePaid(id, userId);
      if (!outcome) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Platform invoice not found');
      }
      if (outcome.alreadyPaid) {
        throw new AppError(ErrorCodes.CONFLICT, 409, 'Invoice is already marked as paid');
      }

      const updated = await prisma.platformInvoice.findUnique({
        where: { id },
        include: {
          society: { select: { id: true, name: true } },
          markedPaidBySuperAdmin: { select: { name: true } },
        } as any,
      });
      if (!updated) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Platform invoice not found');
      }

      sendSuccess(res, toInvoiceResponse(updated as unknown as InvoiceWithSociety));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
