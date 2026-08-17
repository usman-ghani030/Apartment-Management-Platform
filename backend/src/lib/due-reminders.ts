import { prisma } from './prisma';
import { sendNotification } from './notifications';

/**
 * Automated Dues Reminders (Phase 7, slice 2)
 *
 * For every society, find unpaid invoices (ISSUED / OVERDUE, not deleted) whose
 * due date is at or before `now + dueReminderDays` (i.e. coming due within the
 * society's configured window, or already overdue without ever having been
 * reminded). Each (invoice, dueDate) pair gets exactly one reminder thanks to
 * the unique constraint on InvoiceReminder(invoiceId, dueDate).
 *
 * This module is intentionally free of Redis/BullMQ imports so it can be unit
 * tested directly; the queue worker in src/queue/ calls it on a schedule.
 */

export interface DueReminderResult {
  scanned: number;
  reminded: number;
  reminders: { invoiceId: string; invoiceNumber: string; unitNumber: string; dueDate: string }[];
}

export async function sendDueReminders(now: Date = new Date(), societyId?: string): Promise<DueReminderResult> {
  // Load every society with its reminder window (or just one when the manual
  // trigger is scoped to a single tenant). Society count is small (one row per
  // customer), so a single fetch is fine.
  const societies = await prisma.society.findMany({
    where: societyId ? { id: societyId } : undefined,
    select: { id: true, dueReminderDays: true },
  });

  const reminders: DueReminderResult['reminders'] = [];
  let scanned = 0;
  let reminded = 0;

  for (const society of societies) {
    const windowEnd = new Date(now.getTime() + society.dueReminderDays * 24 * 60 * 60 * 1000);

    // Unpaid invoices due within the window (or overdue and never reminded).
    const invoices = await prisma.invoice.findMany({
      where: {
        societyId: society.id,
        deletedAt: null,
        status: { in: ['ISSUED', 'OVERDUE'] },
        dueDate: { lte: windowEnd },
      },
      include: { unit: { select: { unitNumber: true } } },
    });

    scanned += invoices.length;

    for (const invoice of invoices) {
      // Skip if a reminder was already sent for this exact due date.
      const existing = await prisma.invoiceReminder.findUnique({
        where: {
          invoiceId_dueDate: { invoiceId: invoice.id, dueDate: invoice.dueDate },
        },
      });
      if (existing) continue;

      try {
        // Record the reminder first so a crash mid-batch can't double-send.
        await prisma.invoiceReminder.create({
          data: {
            societyId: society.id,
            invoiceId: invoice.id,
            dueDate: invoice.dueDate,
            daysBefore: society.dueReminderDays,
          },
        });

        await sendNotification({
          type: 'DUE_REMINDER',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          societyId: society.id,
          title: invoice.title,
          amount: invoice.amount,
          dueDate: invoice.dueDate.toISOString(),
          daysBefore: society.dueReminderDays,
        });

        reminded += 1;
        reminders.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          unitNumber: invoice.unit.unitNumber,
          dueDate: invoice.dueDate.toISOString(),
        });
      } catch (err) {
        console.error(`[DueReminders] Failed to send reminder for invoice ${invoice.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return { scanned, reminded, reminders };
}
