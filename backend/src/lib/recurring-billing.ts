import { prisma } from './prisma';
import { sendNotification } from './notifications';

/**
 * Automated Recurring Billing (Phase 8, slice 5)
 *
 * For every society with `billingDayOfMonth` configured, generate invoices
 * for all active units on the configured day each month. Idempotency is
 * enforced by the unique constraint on Invoice(societyId, unitId, billingPeriod).
 *
 * This module is intentionally free of Redis/BullMQ imports so it can be unit
 * tested directly; the queue worker in src/queue/ calls it on a schedule.
 *
 * IMPORTANT: This job CREATES invoices on schedule. Phase 7's dues-reminder job
 * REMINDS about existing invoices before their due date. Both coexist.
 */

export interface BillingResult {
  scanned: number;
  created: number;
  skipped: number;
  invoices: { invoiceId: string; invoiceNumber: string; unitNumber: string; amount: number; billingPeriod: string }[];
  errors: string[];
}

/**
 * Generate recurring invoices for all societies with billing configured.
 * If `societyId` is provided, only process that society (for manual triggers).
 * If `now` is provided, use that date (for testing); otherwise use current date.
 */
export async function generateRecurringInvoices(
  now: Date = new Date(),
  societyId?: string
): Promise<BillingResult> {
  const societies = await prisma.society.findMany({
    where: {
      ...(societyId ? { id: societyId } : {}),
      billingDayOfMonth: { not: null },
    },
    select: { id: true, name: true, billingDayOfMonth: true },
  });

  const result: BillingResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    invoices: [],
    errors: [],
  };

  for (const society of societies) {
    const billingDay = society.billingDayOfMonth!;

    // Determine the billing period: YYYY-MM of the current month
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed
    const billingPeriod = `${year}-${String(month).padStart(2, '0')}`;

    // Only generate on the configured day (or if manually triggered with societyId)
    const today = now.getDate();
    if (!societyId && today !== billingDay) {
      // Not the billing day - skip (but log for visibility)
      console.log(
        `[RecurringBilling] Society ${society.name}: today is day ${today}, billing day is ${billingDay} - skipping`
      );
      continue;
    }

    console.log(
      `[RecurringBilling] Society ${society.name}: generating invoices for period ${billingPeriod}`
    );

    // Get all active units (not soft-deleted)
    const units = await prisma.unit.findMany({
      where: {
        societyId: society.id,
        deletedAt: null,
      },
      select: { id: true, unitNumber: true },
    });

    result.scanned += units.length;

    for (const unit of units) {
      // Idempotency check: does an invoice already exist for this unit+period?
      const existing = await prisma.invoice.findFirst({
        where: {
          societyId: society.id,
          unitId: unit.id,
          billingPeriod,
          deletedAt: null,
        },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      try {
        // Generate invoice number: society prefix + period + sequence
        const invoiceCount = await prisma.invoice.count({
          where: { societyId: society.id, billingPeriod },
        });
        const seq = String(invoiceCount + 1).padStart(3, '0');
        const invoiceNumber = `BILL-${billingPeriod.replace('-', '')}-${seq}`;

        // Due date: billing day + 7 days
        const dueDate = new Date(year, month - 1, billingDay + 7);

        const invoice = await prisma.invoice.create({
          data: {
            societyId: society.id,
            unitId: unit.id,
            invoiceNumber,
            title: `Monthly Dues - ${billingPeriod}`,
            description: `Automated recurring billing for ${unit.unitNumber}`,
            amount: 0, // Admin sets amount per unit/invoice later
            dueDate,
            status: 'ISSUED',
            billingPeriod,
            periodStart: new Date(year, month - 1, 1),
            periodEnd: new Date(year, month, 0), // last day of month
          },
        });

        result.created++;
        result.invoices.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          unitNumber: unit.unitNumber,
          amount: invoice.amount,
          billingPeriod,
        });

        // Send notification
        await sendNotification({
          type: 'RECURRING_BILLING_GENERATED',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          societyId: society.id,
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          billingPeriod,
        });
      } catch (err) {
        // Unique constraint violation = already exists (race condition safety)
        if ((err as any).code === 'P2002') {
          result.skipped++;
          console.log(
            `[RecurringBilling] Unit ${unit.unitNumber}: invoice already exists for ${billingPeriod} (race condition)`
          );
        } else {
          const msg = `Unit ${unit.unitNumber}: ${err instanceof Error ? err.message : 'unknown error'}`;
          result.errors.push(msg);
          console.error(`[RecurringBilling] ${msg}`);
        }
      }
    }

    console.log(
      `[RecurringBilling] Society ${society.name}: created ${result.created}, skipped ${result.skipped}, errors ${result.errors.length}`
    );
  }

  return result;
}
