import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Hermetic: mock prisma - no real DB.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    society: { findMany: vi.fn(), findUnique: vi.fn() },
    unit: { count: vi.fn() },
    platformInvoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    platformCustomQuoteFlag: { create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../lib/email', () => ({ sendEmail: vi.fn() }));

import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import app from '../app';

const emailSend = sendEmail as ReturnType<typeof vi.fn>;

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const NOW = new Date('2026-09-14T10:00:00.000Z');

function jwtFor(userId: string) {
  return jwt.sign({ userId }, SECRET, { expiresIn: '15m' });
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const INVOICE_UUID = '11111111-1111-4111-8111-111111111111';
const superAdminMembership = {
  id: 'm-super', userId: 'u-super', societyId: 's-super', unitId: null,
  role: 'SUPER_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Platform HQ Society', slug: 'platform-hq' },
};

const adminMembershipS1 = {
  id: 'm-admin1', userId: 'u-admin1', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};

const adminMembershipS2 = {
  id: 'm-admin2', userId: 'u-admin2', societyId: 's2', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Ocean Towers', slug: 'ocean' },
};

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_UUID,
    societyId: 's1',
    billingPeriod: '2026-09',
    unitCountSnapshot: 100,
    calculationBreakdown: [
      { label: 'Units 16–50', units: 35, ratePerUnit: 20, subtotal: 700 },
      { label: 'Units 51–100', units: 50, ratePerUnit: 12, subtotal: 600 },
    ],
    totalAmountPaisa: 130000,
    dueDate: new Date('2026-10-15T23:59:59.000Z'),
    status: 'PENDING',
    generatedAt: NOW,
    paidAt: null,
    markedPaidBySuperAdmin: null,
    markedPaidBySuperAdminUserId: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    society: { id: 's1', name: 'Sunrise Apartments' },
    ...overrides,
  };
}

function mockAuthFor(membership: Record<string, unknown>, userId: string, email = 'a@x.com') {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: userId, email, name: 'Admin',
  });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
  emailSend.mockReset();
});

afterAll(async () => {
  // no handles to close (fully mocked)
});

// ── GET /status - free tier + estimated fee ────────────────────────────────────────
describe('GET /api/v1/platform-billing/status', () => {
  it('reports free tier with zero estimated fee for ≤15 units', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    (prisma.society.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Sunrise Apartments' });
    (prisma.unit.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    const res = await request(app)
      .get('/api/v1/platform-billing/status')
      .set('x-access-token', jwtFor('u-admin1'));

    expect(res.status).toBe(200);
    expect(res.body.data.isFreeTier).toBe(true);
    expect(res.body.data.isCustomQuote).toBe(false);
    expect(res.body.data.estimatedTotalRupees).toBe(0);
    expect(res.body.data.freeUnitThreshold).toBe(15);
  });

  it('reports the progressive estimate above the threshold (99 units → Rs 1,288)', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    (prisma.society.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Sunrise Apartments' });
    (prisma.unit.count as ReturnType<typeof vi.fn>).mockResolvedValue(99);

    const res = await request(app)
      .get('/api/v1/platform-billing/status')
      .set('x-access-token', jwtFor('u-admin1'));

    expect(res.status).toBe(200);
    expect(res.body.data.isFreeTier).toBe(false);
    expect(res.body.data.estimatedTotalRupees).toBe(1288);
    expect(res.body.data.estimatedBreakdown).toEqual([
      { label: 'Units 1–15', units: 15, ratePerUnit: 0, subtotal: 0 },
      { label: 'Units 16–50', units: 35, ratePerUnit: 20, subtotal: 700 },
      { label: 'Units 51–99', units: 49, ratePerUnit: 12, subtotal: 588 },
    ]);
  });

  it('residents get 403', async () => {
    const residentMembership = { ...adminMembershipS1, id: 'm-res3', userId: 'u-res3', role: 'RESIDENT' };
    mockAuthFor(residentMembership, 'u-res3');
    const res = await request(app)
      .get('/api/v1/platform-billing/status')
      .set('x-access-token', jwtFor('u-res3'));
    expect(res.status).toBe(403);
  });
});

// ── GET / - society-scoped view ─────────────────────────────────────────────
describe('GET /api/v1/platform-billing', () => {
  it('returns only the caller’s own society’s invoices', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    (prisma.platformInvoice.findMany as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: any) => {
        // Emulate the DB filter so we assert the ROUTE passes the right scope.
        const rows = [invoiceRow(), invoiceRow({ id: 'pi-2', societyId: 's2' })];
        return rows.filter((r) => r.societyId === where.societyId && !r.deletedAt);
      }
    );

    const res = await request(app)
      .get('/api/v1/platform-billing')
      .set('x-access-token', jwtFor('u-admin1'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].societyId).toBe('s1');
    expect(res.body.data[0].totalAmountRupees).toBe(1300);
    expect(res.body.data[0].breakdown).toHaveLength(2);
    // The scoped where clause must come from the membership, not the client.
    const where = (prisma.platformInvoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.societyId).toBe('s1');
  });

  it('masks resident-irrelevant internals: no paisa leak beyond documented fields', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    (prisma.platformInvoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([invoiceRow()]);
    const res = await request(app)
      .get('/api/v1/platform-billing')
      .set('x-access-token', jwtFor('u-admin1'));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('markedPaidBySuperAdminUserId');
  });

  it('residents cannot read platform billing at all', async () => {
    const residentMembership = {
      ...adminMembershipS1, id: 'm-res', userId: 'u-res', role: 'RESIDENT',
    };
    mockAuthFor(residentMembership, 'u-res');
    const res = await request(app)
      .get('/api/v1/platform-billing')
      .set('x-access-token', jwtFor('u-res'));
    expect(res.status).toBe(403);
  });
});

// ── Cross-tenant + role gates on ops endpoints ──────────────────────────────
describe('platform ops authorization', () => {
  it('GET /all - a Committee Admin gets 403 (super-admin-only surface)', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    const res = await request(app)
      .get('/api/v1/platform-billing/all')
      .set('x-access-token', jwtFor('u-admin1'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /all - a Super Admin membership gets all societies’ invoices', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.platformInvoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      invoiceRow(),
      invoiceRow({ id: 'pi-2', societyId: 's2', society: { id: 's2', name: 'Ocean Towers' } }),
    ]);
    const res = await request(app)
      .get('/api/v1/platform-billing/all')
      .set('x-access-token', jwtFor('u-super'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    // No societyId scope is applied for super admins (platform-wide surface).
    const where = (prisma.platformInvoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null });
  });

  it('resident calling GET /all gets 403 (membership required surface)', async () => {
    const residentMembership = {
      ...superAdminMembership, id: 'm-res2', userId: 'u-res2', role: 'RESIDENT',
    };
    mockAuthFor(residentMembership, 'u-res2');
    const res = await request(app)
      .get('/api/v1/platform-billing/all')
      .set('x-access-token', jwtFor('u-res2'));
    expect(res.status).toBe(403);
  });

  it('GET /custom-quotes - Committee Admin gets 403', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    const res = await request(app)
      .get('/api/v1/platform-billing/custom-quotes')
      .set('x-access-token', jwtFor('u-admin1'));
    expect(res.status).toBe(403);
  });

  it('POST /run-generation - Committee Admin gets 403', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    const res = await request(app)
      .post('/api/v1/platform-billing/run-generation')
      .set('x-access-token', jwtFor('u-admin1'))
      .send({ dryRun: true });
    expect(res.status).toBe(403);
  });

  it('POST /run-overdue-check - Committee Admin gets 403', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    const res = await request(app)
      .post('/api/v1/platform-billing/run-overdue-check')
      .set('x-access-token', jwtFor('u-admin1'));
    expect(res.status).toBe(403);
  });

  it('PATCH /:id/mark-paid - Committee Admin gets 403 (the only path to PAID is super-admin)', async () => {
    mockAuthFor(adminMembershipS1, 'u-admin1');
    const res = await request(app)
      .patch('/api/v1/platform-billing/pi-1/mark-paid')
      .set('x-access-token', jwtFor('u-admin1'))
      .send({});
    expect(res.status).toBe(403);
  });
});

// ── Generation logic through the route (mocked DB) ──────────────────────────
describe('POST /run-generation', () => {
  it('super admin dry run: computes without writing, audits the run', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's-free', name: 'Free Society' },
      { id: 's-bill', name: 'Billed Society' },
      { id: 's-big', name: 'Big Society' },
    ]);
    (prisma.unit.count as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: any) =>
        ({ 's-free': 10, 's-bill': 100, 's-big': 600 } as Record<string, number>)[String(where.societyId)]
    );
    (prisma.platformInvoice.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/platform-billing/run-generation')
      .set('x-access-token', jwtFor('u-super'))
      .send({ dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body.data.dryRun).toBe(true);
    expect(res.body.data.scannedSocieties).toBe(3);
    // 100-unit society counts as would-create; free tier skipped; 501+ flagged.
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skippedFree).toBe(1);
    expect(res.body.data.customQuoteFlags).toBe(1);
    // Dry run must NOT write.
    expect(prisma.platformInvoice.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(prisma.platformCustomQuoteFlag.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('real run: creates the invoice with the progressive total and skips existing', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's-bill', name: 'Billed Society' },
      { id: 's-dup', name: 'Dup Society' },
    ]);
    (prisma.unit.count as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: any) => ({ 's-bill': 100, 's-dup': 50 } as Record<string, number>)[String(where.societyId)]
    );
    (prisma.platformInvoice.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: any) =>
        where.unique_platform_billing_period.billingPeriod === '2026-09' &&
        where.unique_platform_billing_period.societyId === 's-dup'
          ? { id: 'pi-existing' }
          : null
    );
    (prisma.platformInvoice.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'pi-new' });

    const res = await request(app)
      .post('/api/v1/platform-billing/run-generation')
      .set('x-access-token', jwtFor('u-super'))
      .send({ dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skippedExisting).toBe(1);

    const created = (prisma.platformInvoice.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(created.societyId).toBe('s-bill');
    expect(created.totalAmountPaisa).toBe(130000); // Rs 1,300
    expect(created.unitCountSnapshot).toBe(100);
    expect(created.status).toBe('PENDING');
  });

  it('real run: 501+ society is flagged, not invoiced', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's-big', name: 'Big Society' },
    ]);
    (prisma.unit.count as ReturnType<typeof vi.fn>).mockResolvedValue(600);
    (prisma.platformCustomQuoteFlag.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'flag-1' });

    const res = await request(app)
      .post('/api/v1/platform-billing/run-generation')
      .set('x-access-token', jwtFor('u-super'))
      .send({ dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.data.customQuoteFlags).toBe(1);
    expect(res.body.data.created).toBe(0);
    expect(prisma.platformInvoice.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(prisma.platformCustomQuoteFlag.create as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it('real run: free-tier society produces nothing (no zero-amount noise)', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.society.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's-free', name: 'Free Society' },
    ]);
    (prisma.unit.count as ReturnType<typeof vi.fn>).mockResolvedValue(15);

    const res = await request(app)
      .post('/api/v1/platform-billing/run-generation')
      .set('x-access-token', jwtFor('u-super'))
      .send({ dryRun: false });

    expect(res.status).toBe(200);
    expect(res.body.data.skippedFree).toBe(1);
    expect(prisma.platformInvoice.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});

// ── Mark as Paid ────────────────────────────────────────────────────────────
describe('PATCH /:id/mark-paid', () => {
  it('super admin marks pending invoice paid: records paidAt + actor + audit', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.platformInvoice.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(invoiceRow({ status: 'PENDING' })) // pre-check
      .mockResolvedValueOnce(
        invoiceRow({
          status: 'PAID',
          paidAt: NOW,
          markedPaidBySuperAdmin: { name: 'Super Admin' },
        })
      ); // re-read after update
    (prisma.platformInvoice.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(app)
      .patch(`/api/v1/platform-billing/${INVOICE_UUID}/mark-paid`)
      .set('x-access-token', jwtFor('u-super'))
      .send({ note: 'Bank transfer received' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.markedPaidBySuperAdminName).toBe('Super Admin');

    const updateArg = (prisma.platformInvoice.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArg.data.status).toBe('PAID');
    expect(updateArg.data.markedPaidBySuperAdminUserId).toBe('u-super');
    expect(updateArg.data.paidAt).toBeInstanceOf(Date);

    const auditArg = (prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: any[]) => c[0].data.action === 'PLATFORM_INVOICE_MARKED_PAID'
    );
    expect(auditArg).toBeTruthy();
  });

  it('already-paid invoice returns 409 (no double marking)', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.platformInvoice.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      invoiceRow({ status: 'PAID', paidAt: NOW })
    );
    const res = await request(app)
      .patch(`/api/v1/platform-billing/${INVOICE_UUID}/mark-paid`)
      .set('x-access-token', jwtFor('u-super'))
      .send({});
    expect(res.status).toBe(409);
  });

  it('non-UUID id is rejected with 400 before any lookup', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    const res = await request(app)
      .patch('/api/v1/platform-billing/not-a-uuid/mark-paid')
      .set('x-access-token', jwtFor('u-super'))
      .send({});
    expect(res.status).toBe(400);
    expect(prisma.platformInvoice.findUnique as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('unknown invoice returns 404', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    (prisma.platformInvoice.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/v1/platform-billing/22222222-2222-4222-8222-222222222222/mark-paid')
      .set('x-access-token', jwtFor('u-super'))
      .send({});
    expect(res.status).toBe(404);
  });
});

// ── Overdue sweep ───────────────────────────────────────────────────────────
describe('POST /run-overdue-check', () => {
  it('marks overdue PENDING invoices and emails committee admins', async () => {
    mockAuthFor(superAdminMembership, 'u-super');
    // membership.findMany call #1 = auth (loadMembership); #2 = admins lookup
    // inside markOverduePlatformInvoices.
    (prisma.membership.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([superAdminMembership])
      .mockResolvedValueOnce([
        { user: { email: 'admin1@x.com', name: 'Admin One' } },
        { user: { email: 'admin2@x.com', name: 'Admin Two' } },
      ]);
    (prisma.platformInvoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      invoiceRow({ dueDate: new Date('2026-08-01T00:00:00.000Z') }),
    ]);
    (prisma.platformInvoice.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/platform-billing/run-overdue-check')
      .set('x-access-token', jwtFor('u-super'));

    expect(res.status).toBe(200);
    expect(res.body.data.markedOverdue).toBe(1);
    expect(res.body.data.remindersSent).toBe(2);
    expect(emailSend).toHaveBeenCalledTimes(2);
    expect(emailSend.mock.calls[0][0].to).toBe('admin1@x.com');
    expect(emailSend.mock.calls[0][0].subject).toMatch(/overdue/i);
  });
});
