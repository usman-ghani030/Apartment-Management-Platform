import { prisma } from './prisma';
import { logAudit } from './audit';
import { sendEmail } from './email';
import {
  calculatePlatformFee,
  requiresCustomQuote,
  FREE_UNIT_THRESHOLD,
  PLATFORM_PRICING,
} from '../config/platform-pricing';
import type { PlatformBandLine } from '@apartment/shared';

/**
 * Platform Billing (Phase 9, ADR 006) — societies paying the PLATFORM.
 *
 * Entirely separate from resident dues (`lib/recurring-billing.ts`, Phase 2):
 * different payer (the society), different recipient (the platform), different
 * entity (PlatformInvoice vs Invoice). Never merge the two systems.
 *
 * Rate table lives in src/config/platform-pricing.ts — config change, not code.
 *
 * This module is intentionally free of Redis/BullMQ imports so it can be unit
 * tested directly; the queue worker in src/queue/ calls it on a schedule.
 */

function billingPeriodFor(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function dueDateForPeriod(now: Date): Date {
  // Due on the 15th of the following month (grace period for a bank transfer).
  return new Date(now.getFullYear(), now.getMonth() + 1, 15, 23, 59, 59);
}

export interface PlatformBillingResult {
  scannedSocieties: number;
  created: number;
  skippedFree: number;
  skippedExisting: number;
  customQuoteFlags: number;
  errors: string[];
}

/**
 * Generate platform invoices for all active societies for the current billing
 * period. Idempotent: the unique (societyId, billingPeriod) constraint plus an
 * upfront existence check means running twice never duplicates an invoice.
 *
 * `dryRun` computes everything but writes nothing (and creates no flags) —
 * used for the first real run's sanity check and for tests.
 *
 * - ≤15 active units  → skipped entirely (no zero-amount invoice noise)
 * - 16–500 units      → progressive calculation → PlatformInvoice
 * - 501+ units        → NOT auto-invoiced; flagged for a manual custom quote
 */
export async function generatePlatformInvoices(
  now: Date = new Date(),
  options: { dryRun?: boolean; societyId?: string } = {}
): Promise<PlatformBillingResult> {
  const { dryRun = false, societyId: onlySocietyId } = options;
  const billingPeriod = billingPeriodFor(now);
  const dueDate = dueDateForPeriod(now);

  const result: PlatformBillingResult = {
    scannedSocieties: 0,
    created: 0,
    skippedFree: 0,
    skippedExisting: 0,
    customQuoteFlags: 0,
    errors: [],
  };

  const societies = await prisma.society.findMany({
    where: onlySocietyId ? { id: onlySocietyId } : undefined,
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const society of societies) {
    result.scannedSocieties++;

    try {
      // Active unit count — same definition the rest of the app uses
      // (soft-delete filtered; Unit.deletedAt === null).
      const unitCount = await prisma.unit.count({
        where: { societyId: society.id, deletedAt: null },
      });

      // Free tier: no invoice, no noise.
      if (unitCount <= FREE_UNIT_THRESHOLD) {
        result.skippedFree++;
        continue;
      }

      // 501+ units: custom quote only — never auto-invoice. One flag per
      // society per period (unique constraint; race-safe via P2002).
      if (requiresCustomQuote(unitCount)) {
        result.customQuoteFlags++;
        if (dryRun) continue;
        try {
          await prisma.platformCustomQuoteFlag.create({
            data: {
              societyId: society.id,
              billingPeriod,
              unitCountSnapshot: unitCount,
              note: `Society has ${unitCount} active units — exceeds the ${PLATFORM_PRICING.autoInvoiceCap}-unit auto-invoice cap. Manual custom quote required.`,
            },
          });
          await logAudit({
            societyId: society.id,
            actorUserId: null,
            action: 'PLATFORM_CUSTOM_QUOTE_FLAGGED',
            entityType: 'platform_custom_quote_flag',
            entityId: society.id,
            after: { billingPeriod, unitCountSnapshot: unitCount },
          });
        } catch (err) {
          if ((err as any).code === 'P2002') {
            // Flag already exists for this society+period — fine.
          } else {
            throw err;
          }
        }
        continue;
      }

      // Idempotency check before writing.
      const existing = await prisma.platformInvoice.findUnique({
        where: {
          unique_platform_billing_period: {
            societyId: society.id,
            billingPeriod,
          },
        },
        select: { id: true },
      });
      if (existing) {
        result.skippedExisting++;
        continue;
      }

      const calc = calculatePlatformFee(unitCount);
      const breakdown: PlatformBandLine[] = calc.breakdown;

      if (dryRun) {
        result.created++; // would-create count in dry-run mode
        console.log(
          `[PlatformBilling] DRY RUN — ${society.name} (${unitCount} units, ${billingPeriod}): would create invoice Rs ${calc.totalRupees}`
        );
        continue;
      }

      await prisma.platformInvoice.create({
        data: {
          societyId: society.id,
          billingPeriod,
          unitCountSnapshot: unitCount,
          calculationBreakdown: breakdown as unknown as any,
          totalAmountPaisa: calc.totalRupees * 100,
          dueDate,
          status: 'PENDING',
        },
      });
      result.created++;

      await logAudit({
        societyId: society.id,
        actorUserId: null,
        action: 'PLATFORM_INVOICE_GENERATED',
        entityType: 'platform_invoice',
        entityId: society.id,
        after: {
          billingPeriod,
          unitCountSnapshot: unitCount,
          totalAmountRupees: calc.totalRupees,
        },
      });

      console.log(
        `[PlatformBilling] ${society.name} (${unitCount} units, ${billingPeriod}): invoice Rs ${calc.totalRupees} created`
      );
    } catch (err) {
      if ((err as any).code === 'P2002') {
        // Lost a race (concurrent run) — the invoice already exists.
        result.skippedExisting++;
      } else {
        const msg = `${society.name}: ${err instanceof Error ? err.message : 'unknown error'}`;
        result.errors.push(msg);
        console.error(`[PlatformBilling] ${msg}`);
      }
    }
  }

  return result;
}

export interface PlatformOverdueResult {
  scanned: number;
  markedOverdue: number;
  remindersSent: number;
  errors: string[];
}

/**
 * Mark unpaid platform invoices whose due date has passed as OVERDUE and email
 * a reminder to each society's Committee Admins via the shared EmailProvider
 * (ADR 004). Notification only — nothing is restricted (ADR 006).
 */
export async function markOverduePlatformInvoices(
  now: Date = new Date()
): Promise<PlatformOverdueResult> {
  const result: PlatformOverdueResult = {
    scanned: 0,
    markedOverdue: 0,
    remindersSent: 0,
    errors: [],
  };

  const dueInvoices = await prisma.platformInvoice.findMany({
    where: { status: 'PENDING', dueDate: { lt: now }, deletedAt: null },
    include: { society: { select: { id: true, name: true } } },
  });
  result.scanned = dueInvoices.length;

  for (const invoice of dueInvoices) {
    try {
      await prisma.platformInvoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });
      result.markedOverdue++;

      await logAudit({
        societyId: invoice.societyId,
        actorUserId: null,
        action: 'PLATFORM_INVOICE_MARKED_OVERDUE',
        entityType: 'platform_invoice',
        entityId: invoice.id,
        after: { billingPeriod: invoice.billingPeriod, dueDate: invoice.dueDate.toISOString() },
      });

      // Reminder email to every active Committee Admin of the society.
      const admins = await prisma.membership.findMany({
        where: {
          societyId: invoice.societyId,
          status: 'ACTIVE',
          deletedAt: null,
          role: { in: ['COMMITTEE_ADMIN', 'SUPER_ADMIN'] },
        },
        include: { user: { select: { email: true, name: true } } },
      });

      const periodLabel = invoice.billingPeriod;
      const totalRs = invoice.totalAmountPaisa / 100;
      for (const admin of admins) {
        if (!admin.user?.email) continue;
        try {
          await sendEmail({
            to: admin.user.email,
            subject: `Action needed: platform invoice ${periodLabel} is overdue`,
            text:
              `Dear ${admin.user.name || 'Committee Admin'},\n\n` +
              `Your OmniHome platform invoice for ${periodLabel} (Rs ${totalRs.toLocaleString()}) ` +
              `was due on ${invoice.dueDate.toISOString().slice(0, 10)} and is now overdue.\n\n` +
              `Please arrange the bank transfer at your earliest convenience. Bank details are available ` +
              `on the Platform billing page of your dashboard. Your society's access to features is not ` +
              `affected at this stage.\n\n— The OmniHome team`,
            html:
              `<p>Dear ${admin.user.name || 'Committee Admin'},</p>` +
              `<p>Your OmniHome platform invoice for <strong>${periodLabel}</strong> ` +
              `(Rs ${totalRs.toLocaleString()}) was due on ` +
              `${invoice.dueDate.toISOString().slice(0, 10)} and is now <strong>overdue</strong>.</p>` +
              `<p>Please arrange the bank transfer at your earliest convenience — bank details are on ` +
              `the Platform billing page of your dashboard. Your society's access to features is not ` +
              `affected at this stage.</p>` +
              `<p>— The OmniHome team</p>`,
          });
          result.remindersSent++;
        } catch (emailErr) {
          // Email failure must not stop the overdue sweep; the status change
          // is already committed and audited.
          const msg = `reminder email to ${admin.user.email}: ${
            emailErr instanceof Error ? emailErr.message : 'unknown error'
          }`;
          result.errors.push(msg);
          console.error(`[PlatformBilling] ${msg}`);
        }
      }
    } catch (err) {
      const msg = `${invoice.society.name}: ${err instanceof Error ? err.message : 'unknown error'}`;
      result.errors.push(msg);
      console.error(`[PlatformBilling] ${msg}`);
    }
  }

  return result;
}

/**
 * Super Admin marks an invoice paid (the ONLY path to PAID — no self-service
 * for Committee Admins). Returns the updated invoice id, or null if it was
 * already paid (idempotent double-click protection at the caller's option).
 */
export async function markPlatformInvoicePaid(
  invoiceId: string,
  superAdminUserId: string
): Promise<{ alreadyPaid: boolean } | null> {
  const invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return null;

  if (invoice.status === 'PAID') {
    return { alreadyPaid: true };
  }

  await prisma.platformInvoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      markedPaidBySuperAdminUserId: superAdminUserId,
    },
  });

  await logAudit({
    societyId: invoice.societyId,
    actorUserId: superAdminUserId,
    action: 'PLATFORM_INVOICE_MARKED_PAID',
    entityType: 'platform_invoice',
    entityId: invoiceId,
    before: { status: invoice.status },
    after: { status: 'PAID', billingPeriod: invoice.billingPeriod },
  });

  return { alreadyPaid: false };
}
