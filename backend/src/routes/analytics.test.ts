import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    invoice: { aggregate: vi.fn() },
    payment: { aggregate: vi.fn() },
    ticket: { findMany: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
    unit: { groupBy: vi.fn() },
    visitorPass: { count: vi.fn() },
    parcel: { count: vi.fn() },
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

const fn = (name: keyof typeof prisma, method: string) =>
  (prisma[name] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

/**
 * Fills in every aggregate the route reaches for. Each mock keys off the
 * arguments it receives rather than call order, so the tests stay readable if
 * the route adds another query.
 */
function mockAggregates() {
  // Invoices: Rs.1000 per bucket, Rs.900 outstanding, Rs.400 of that overdue.
  fn('invoice', 'aggregate').mockImplementation((args: any) => {
    if (args?.where?.status === 'OVERDUE') return Promise.resolve({ _sum: { amount: 40000 }, _count: { _all: 1 } });
    if (Array.isArray(args?.where?.status?.in)) return Promise.resolve({ _sum: { amount: 90000 }, _count: { _all: 4 } });
    return Promise.resolve({ _sum: { amount: 100000 }, _count: { _all: 2 } });
  });

  // Payments: Rs.500 collected in three payments.
  fn('payment', 'aggregate').mockResolvedValue({ _sum: { amount: 50000 }, _count: { _all: 3 } });

  // Tickets: opened 3 in range, closed 2 in range, one closed in 48h.
  fn('ticket', 'count').mockImplementation((args: any) => {
    if (args?.where?.assignedTo) return Promise.resolve(4);
    if (args?.where?.closedAt) return Promise.resolve(2);
    return Promise.resolve(3);
  });
  fn('ticket', 'findMany').mockResolvedValue([
    { createdAt: new Date('2026-08-01T08:00:00Z'), closedAt: new Date('2026-08-03T08:00:00Z'), updatedAt: new Date('2026-08-03T08:00:00Z') },
  ]);
  fn('ticket', 'findFirst').mockResolvedValue({ createdAt: new Date(Date.now() - 5 * 86_400_000) });
  fn('ticket', 'groupBy').mockImplementation((args: any) => {
    if (args?.by?.[0] === 'status') {
      return Promise.resolve([
        { status: 'OPEN', _count: { _all: 3 } },
        { status: 'IN_PROGRESS', _count: { _all: 1 } },
        { status: 'CLOSED', _count: { _all: 6 } },
      ]);
    }
    if (args?.by?.[0] === 'category') {
      return Promise.resolve([
        { category: 'plumbing', _count: { _all: 3 } },
        { category: 'electrical', _count: { _all: 1 } },
      ]);
    }
    // assignedTo: with _avg it is the ratings query, without it is the volume.
    if (args?._avg) {
      return Promise.resolve([{ assignedTo: 'ABC Plumbing', _avg: { rating: 4.5 }, _count: { rating: 2 } }]);
    }
    return Promise.resolve([{ assignedTo: 'ABC Plumbing', _count: { _all: 2 } }]);
  });

  fn('membership', 'count').mockImplementation((args: any) => {
    if (args?.where?.role === 'RESIDENT') return Promise.resolve(12);
    if (args?.where?.role === 'SECURITY_GUARD') return Promise.resolve(2);
    return Promise.resolve(3);
  });
  fn('visitorPass', 'count').mockImplementation((args: any) => {
    if (args?.where?.status === 'CHECKED_IN') return Promise.resolve(2);
    if (args?.where?.status === 'PENDING') return Promise.resolve(1);
    return Promise.resolve(9);
  });
  fn('parcel', 'count').mockImplementation((args: any) =>
    Promise.resolve(args?.where?.status === 'ARRIVED' ? 2 : 5)
  );
  fn('unit', 'groupBy').mockResolvedValue([
    { type: 'OWNER_OCCUPIED', _count: { _all: 6 } },
    { type: 'RENTED', _count: { _all: 3 } },
    { type: 'VACANT', _count: { _all: 1 } },
  ]);
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

  it('rejects an unknown range', async () => {
    mockAuth(adminMembership);
    const res = await request(app).get('/api/v1/analytics?range=99y').set('x-access-token', adminToken);
    expect(res.status).toBe(400);
  });

  it('defaults to six monthly buckets and reports dues, tickets, vendors and occupancy', async () => {
    mockAuth(adminMembership);
    mockAggregates();

    const res = await request(app).get('/api/v1/analytics').set('x-access-token', adminToken);
    expect(res.status).toBe(200);
    const d = res.body.data;

    // Range + trend
    expect(d.range).toBe('6m');
    expect(d.granularity).toBe('month');
    expect(d.trend).toHaveLength(6);
    for (const point of d.trend) {
      expect(point.invoiced).toBe(100000);
      expect(point.collected).toBe(50000);
      expect(point.rate).toBe(50);
    }

    // Dues, including the outstanding snapshot
    expect(d.dues.invoiced).toBe(100000);
    expect(d.dues.collected).toBe(50000);
    expect(d.dues.collectionRate).toBe(50);
    expect(d.dues.paymentsReceived).toBe(3);
    expect(d.dues.outstanding).toBe(90000);
    expect(d.dues.outstandingCount).toBe(4);
    expect(d.dues.overdueAmount).toBe(40000);
    expect(d.dues.overdueCount).toBe(1);

    // Tickets: 48 hours / 2 days resolution, 4 open right now
    expect(d.tickets.created).toBe(3);
    expect(d.tickets.closed).toBe(2);
    expect(d.tickets.openNow).toBe(4);
    expect(d.tickets.avgResolutionHours).toBe(48);
    expect(d.tickets.avgResolutionDays).toBe(2);
    expect(d.tickets.byCategory).toEqual([
      { category: 'plumbing', count: 3 },
      { category: 'electrical', count: 1 },
    ]);
    expect(d.tickets.busiestCategory).toEqual({ category: 'plumbing', count: 3 });
    expect(d.tickets.openOldestDays).toBe(5);
    expect(d.tickets.byStatus).toHaveLength(3);

    // Vendors scoped to the window
    expect(d.vendors.performance).toEqual([
      { vendorName: 'ABC Plumbing', avgRating: 4.5, ratingCount: 2, closedTickets: 2 },
    ]);
    expect(d.vendors.assignedCount).toBe(4);
    expect(d.vendors.ratedCount).toBe(2);

    // People + occupancy
    expect(d.people).toEqual({
      newMembers: 3,
      activeResidents: 12,
      activeGuards: 2,
      visitorPasses: 9,
      visitorsOnSite: 2,
      pendingVisitors: 1,
      parcelsLogged: 5,
      parcelsWaiting: 2,
    });
    expect(d.occupancy).toEqual({
      totalUnits: 10,
      occupiedUnits: 9,
      vacantUnits: 1,
      ownerOccupied: 6,
      rented: 3,
      occupancyRate: 90,
    });

    // Legacy shape the admin dashboard home reads
    expect(d.duesCollection).toHaveLength(6);
    expect(d.duesCollection[0].month).toMatch(/^\d{4}-\d{2}$/);
    expect(d.ticketResolution).toEqual({ closedCount: 1, avgHours: 48, avgDays: 2 });
  });

  it('buckets one month by week', async () => {
    mockAuth(adminMembership);
    mockAggregates();

    const res = await request(app).get('/api/v1/analytics?range=1m').set('x-access-token', adminToken);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.range).toBe('1m');
    expect(d.granularity).toBe('week');
    expect(d.trend).toHaveLength(4);
    // Weekly buckets are still labelled for the chart.
    expect(d.trend[0].label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    // The legacy six month series is unaffected by the selected range.
    expect(d.duesCollection).toHaveLength(6);
  });

  it('buckets a year by calendar month with year-suffixed labels', async () => {
    mockAuth(adminMembership);
    mockAggregates();

    const res = await request(app).get('/api/v1/analytics?range=1y').set('x-access-token', adminToken);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.range).toBe('1y');
    expect(d.granularity).toBe('month');
    expect(d.trend).toHaveLength(12);
    expect(d.trend[0].label).toMatch(/^[A-Z][a-z]{2} \d{2}$/);
    expect(d.duesCollection).toHaveLength(6);
  });

  it('handles empty data gracefully (null rates, zero counts)', async () => {
    mockAuth(adminMembership);
    fn('invoice', 'aggregate').mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } });
    fn('payment', 'aggregate').mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } });
    fn('ticket', 'count').mockResolvedValue(0);
    fn('ticket', 'findMany').mockResolvedValue([]);
    fn('ticket', 'findFirst').mockResolvedValue(null);
    fn('ticket', 'groupBy').mockResolvedValue([]);
    fn('membership', 'count').mockResolvedValue(0);
    fn('visitorPass', 'count').mockResolvedValue(0);
    fn('parcel', 'count').mockResolvedValue(0);
    fn('unit', 'groupBy').mockResolvedValue([]);

    const res = await request(app).get('/api/v1/analytics').set('x-access-token', adminToken);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.dues.collectionRate).toBeNull();
    expect(d.trend.every((p: { rate: number | null }) => p.rate === null)).toBe(true);
    expect(d.duesCollection.every((b: { rate: number | null }) => b.rate === null)).toBe(true);
    expect(d.tickets.avgResolutionDays).toBeNull();
    expect(d.tickets.busiestCategory).toBeNull();
    expect(d.tickets.openOldestDays).toBeNull();
    expect(d.vendors.performance).toEqual([]);
    expect(d.occupancy.occupancyRate).toBeNull();
    expect(d.occupancy.totalUnits).toBe(0);
    expect(d.ticketResolution).toEqual({ closedCount: 0, avgHours: null, avgDays: null });
  });
});
