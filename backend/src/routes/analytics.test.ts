import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    invoice: { aggregate: vi.fn() },
    payment: { aggregate: vi.fn() },
    ticket: { findMany: vi.fn(), groupBy: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import app from '../app';

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });

const adminMembership = {
  id: 'm-admin', userId: 'u-admin', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};
const residentMembership = {
  id: 'm-res', userId: 'u-resident', societyId: 's1', unitId: 'u1',
  role: 'RESIDENT', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};

function mockAuth(membership: unknown) {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u', email: 'u@x.com', name: 'U' });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('GET /api/v1/analytics', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/analytics');
    expect(res.status).toBe(401);
  });

  it('forbids residents (403)', async () => {
    mockAuth(residentMembership);
    const res = await request(app).get('/api/v1/analytics').set('x-access-token', residentToken);
    expect(res.status).toBe(403);
  });

  it('aggregates collection rate, resolution time, categories, and vendor performance', async () => {
    mockAuth(adminMembership);

    // Every month: Rs.1000 invoiced (100000 paisa), Rs.500 collected (50000) → 50%.
    (prisma.invoice.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { amount: 100000 } });
    (prisma.payment.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { amount: 50000 } });

    // One closed ticket: opened Aug 1 08:00, closed Aug 3 08:00 → 48 hours / 2 days.
    (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { createdAt: new Date('2026-08-01T08:00:00Z'), closedAt: new Date('2026-08-03T08:00:00Z'), updatedAt: new Date('2026-08-03T08:00:00Z') },
    ]);

    (prisma.ticket.groupBy as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ category: 'plumbing', _count: { _all: 3 } }, { category: 'electrical', _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ assignedTo: 'ABC Plumbing', _avg: { rating: 4.5 }, _count: { rating: 2 } }])
      .mockResolvedValueOnce([{ assignedTo: 'ABC Plumbing', _count: { _all: 2 } }]);

    const res = await request(app).get('/api/v1/analytics').set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    const d = res.body.data;

    // Collection: 6 monthly buckets, each 50%.
    expect(d.duesCollection).toHaveLength(6);
    for (const bucket of d.duesCollection) {
      expect(bucket.invoiced).toBe(100000);
      expect(bucket.collected).toBe(50000);
      expect(bucket.rate).toBe(50);
    }

    expect(d.ticketResolution).toEqual({ closedCount: 1, avgHours: 48, avgDays: 2 });

    expect(d.ticketVolumeByCategory).toEqual([
      { category: 'plumbing', count: 3 },
      { category: 'electrical', count: 1 },
    ]);

    expect(d.vendorPerformance).toEqual([
      { vendorName: 'ABC Plumbing', avgRating: 4.5, ratingCount: 2, closedTickets: 2 },
    ]);
  });

  it('handles empty data gracefully (null rates, zero counts)', async () => {
    mockAuth(adminMembership);
    (prisma.invoice.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { amount: 0 } });
    (prisma.payment.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({ _sum: { amount: 0 } });
    (prisma.ticket.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.ticket.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/analytics').set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data.duesCollection.every((b: { rate: number | null }) => b.rate === null)).toBe(true);
    expect(res.body.data.ticketResolution).toEqual({ closedCount: 0, avgHours: null, avgDays: null });
    expect(res.body.data.ticketVolumeByCategory).toEqual([]);
    expect(res.body.data.vendorPerformance).toEqual([]);
  });
});
