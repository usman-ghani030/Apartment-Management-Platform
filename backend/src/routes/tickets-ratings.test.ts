import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    ticket: { findFirst: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import app from '../app';

// app's dotenv.config() has run by now, so this matches what verifyAccessToken uses.
const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });

// A complete-enough Ticket row so formatTicket() can serialize it.
const NOW = new Date();
function closedTicket(overrides: Record<string, unknown>) {
  return {
    id: 't1', societyId: 's1', unitId: null, residentId: 'u-resident',
    title: 'Leak', description: 'Kitchen leak', category: 'plumbing',
    status: 'CLOSED', assignedTo: null, photosUrl: null, deletedAt: null,
    rating: null, ratingComment: null, ratedById: null, ratedAt: null,
    createdAt: NOW, updatedAt: NOW,
    resident: { name: 'Resident' }, unit: null, ratedBy: null, _count: { comments: 0 },
    ...overrides,
  };
}

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

function mockAuth(userId: string, membership: unknown) {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userId, email: `${userId}@x.com`, name: userId });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('PATCH /api/v1/tickets/:id — vendor rating rules', () => {
  it('rejects a rating when the ticket is not being closed (400)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1', societyId: 's1', status: 'OPEN', title: 'Leak', residentId: 'u-resident',
    });

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ status: 'ASSIGNED', rating: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('only be given when the ticket is closed');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('saves the rating + author when closing a ticket', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1', societyId: 's1', status: 'IN_PROGRESS', title: 'Leak', residentId: 'u-resident',
    });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(closedTicket({
        rating: data.rating, ratingComment: data.ratingComment,
        ratedById: data.ratedById, ratedAt: data.ratedAt,
      }))
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ status: 'CLOSED', rating: 4, ratingComment: 'Quick and professional' });

    expect(res.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 't1' },
      data: expect.objectContaining({
        status: 'CLOSED',
        rating: 4,
        ratingComment: 'Quick and professional',
        ratedById: 'u-admin',
        ratedAt: expect.any(Date),
      }),
    }));
    expect(res.body.data.rating).toBe(4);
    expect(res.body.data.ratingComment).toBe('Quick and professional');
  });

  it('closes without rating fields when no rating is provided', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1', societyId: 's1', status: 'RESOLVED', title: 'Leak', residentId: 'u-resident',
    });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(closedTicket({}))
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 't1' },
      data: expect.objectContaining({ status: 'CLOSED' }),
    }));
    const data = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.rating).toBeUndefined();
    expect(data.ratedById).toBeUndefined();
  });

  it('allows re-rating an already-closed ticket', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1', societyId: 's1', status: 'CLOSED', title: 'Leak', residentId: 'u-resident', rating: 3,
    });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(closedTicket({
        rating: data.rating, ratedById: data.ratedById, ratedAt: data.ratedAt,
      }))
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ rating: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(5);
  });
});

describe('GET /api/v1/tickets/vendor-ratings', () => {
  it('returns aggregated ratings grouped by vendor, sorted by average', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { assignedTo: 'ABC Plumbing', _avg: { rating: 4.333333333333333 }, _count: { rating: 3 } },
      { assignedTo: 'Sunrise Electric', _avg: { rating: 5 }, _count: { rating: 1 } },
    ]);

    const res = await request(app)
      .get('/api/v1/tickets/vendor-ratings')
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { vendorName: 'Sunrise Electric', avgRating: 5, count: 1 },
      { vendorName: 'ABC Plumbing', avgRating: 4.3, count: 3 },
    ]);
  });

  it('forbids residents from reading vendor ratings (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .get('/api/v1/tickets/vendor-ratings')
      .set('x-access-token', residentToken);

    expect(res.status).toBe(403);
    expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/tickets/vendor-ratings');
    expect(res.status).toBe(401);
  });
});
