import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
  prisma: {
    society: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    invoiceReminder: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

// notifications.ts logs to console in non-production — silence it in tests.
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { prisma } from './prisma';
import { sendDueReminders } from './due-reminders';

const NOW = new Date('2026-08-17T10:00:00Z');

function makeSociety(id: string, dueReminderDays: number) {
  return { id, dueReminderDays };
}

function makeInvoice(overrides: Partial<{ id: string; invoiceNumber: string; title: string; amount: number; dueDate: Date; status: string; unitNumber: string }> = {}) {
  return {
    id: overrides.id ?? 'inv-1',
    invoiceNumber: overrides.invoiceNumber ?? 'INV-001',
    title: overrides.title ?? 'Maintenance dues',
    amount: overrides.amount ?? 5000,
    dueDate: overrides.dueDate ?? NOW,
    status: overrides.status ?? 'ISSUED',
    unit: { unitNumber: overrides.unitNumber ?? 'A-101' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendDueReminders', () => {
  it('reminds once for an unpaid invoice due within the window', async () => {
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeSociety('s1', 3)]);
    (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeInvoice({ dueDate: new Date(NOW.getTime() + 2 * 86400000) })]);
    (prisma.invoiceReminder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.invoiceReminder.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await sendDueReminders(NOW);

    expect(result.reminded).toBe(1);
    expect(result.scanned).toBe(1);
    expect(prisma.invoiceReminder.create).toHaveBeenCalledTimes(1);
    expect(prisma.invoiceReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoiceId: 'inv-1', societyId: 's1', daysBefore: 3 }),
      })
    );
  });

  it('does not remind for invoices due beyond the window', async () => {
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeSociety('s1', 3)]);
    // 10 days out — outside the 3-day window, so the query should exclude it.
    (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await sendDueReminders(NOW);

    expect(result.reminded).toBe(0);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: 's1',
          status: { in: ['ISSUED', 'OVERDUE'] },
          dueDate: { lte: new Date(NOW.getTime() + 3 * 86400000) },
        }),
      })
    );
  });

  it('skips invoices that were already reminded for the same due date', async () => {
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeSociety('s1', 3)]);
    (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeInvoice()]);
    (prisma.invoiceReminder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'rem-1' }); // already reminded

    const result = await sendDueReminders(NOW);

    expect(result.reminded).toBe(0);
    expect(prisma.invoiceReminder.create).not.toHaveBeenCalled();
  });

  it('scans only the requested society for a tenant-scoped manual run', async () => {
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeSociety('s1', 3)]);
    (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await sendDueReminders(NOW, 's1');

    expect(prisma.society.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } })
    );
  });

  it('skips a failed reminder for one invoice without aborting the batch', async () => {
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makeSociety('s1', 3)]);
    (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeInvoice({ id: 'inv-a' }),
      makeInvoice({ id: 'inv-b', invoiceNumber: 'INV-002' }),
    ]);
    (prisma.invoiceReminder.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.invoiceReminder.create as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockResolvedValueOnce({});

    const result = await sendDueReminders(NOW);

    expect(result.reminded).toBe(1); // inv-b still processed
    expect(prisma.invoiceReminder.create).toHaveBeenCalledTimes(2);
  });
});
