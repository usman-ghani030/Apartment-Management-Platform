import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    society: { findUnique: vi.fn() },
    ticket: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

// The email provider is mocked — we assert on what would be sent, not that Gmail
// accepted it (that is verified live, per the manual test guide).
vi.mock('../lib/email', () => ({ sendEmail: vi.fn() }));

// Keep the notification stub from writing audit rows through the mocked client
// in ways that muddy the assertions.
vi.mock('../lib/notifications', () => ({ sendNotification: vi.fn() }));

import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { hashVendorAccessToken } from '../lib/vendor-access';
import { vendorTokenIpLimiter, vendorTokenLookupLimiter } from '../lib/rate-limit';
import app from '../app';

const emailSend = sendEmail as ReturnType<typeof vi.fn>;

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const NOW = new Date('2026-09-13T10:00:00.000Z');

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A token we "issued" earlier; only its hash is ever in the DB. */
const VENDOR_TOKEN = 'v'.repeat(43);
const VENDOR_TOKEN_HASH = hashVendorAccessToken(VENDOR_TOKEN);
const OTHER_TOKEN = 'w'.repeat(43);

function vendorTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1-ticket-uuid',
    societyId: 's1',
    unitId: 'unit-1',
    residentId: 'u-resident',
    title: 'Water leak in bathroom',
    description: 'Water is dripping under the sink.',
    category: 'plumbing',
    status: 'ASSIGNED',
    assignedTo: 'ABC Plumbing',
    vendorEmail: 'vendor@example.com',
    vendorAccessTokenHash: VENDOR_TOKEN_HASH,
    vendorAccessTokenIssuedAt: NOW,
    photosUrl: JSON.stringify(['/api/v1/tickets/photo/leak-1.jpg']),
    rating: null,
    ratingComment: null,
    ratedById: null,
    ratedAt: null,
    closedAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    // relations selected by the vendor portal
    society: { name: 'Sunrise Apartments' },
    unit: { unitNumber: 'A-101' },
    ...overrides,
  };
}

/** Ticket row shaped for the authenticated PATCH route's formatter. */
function adminTicket(overrides: Record<string, unknown> = {}) {
  return {
    ...vendorTicket(),
    resident: { name: 'Resident Person' },
    ratedBy: null,
    _count: { comments: 0 },
    ...overrides,
  };
}

const adminMembership = {
  id: 'm-admin', userId: 'u-admin', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
};

function mockAuth() {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'u-admin', email: 'admin@x.com', name: 'Admin',
  });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([adminMembership]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vendorTokenIpLimiter.reset();
  vendorTokenLookupLimiter.reset();
  (prisma.society.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Sunrise Apartments' });
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// The vendor's limited, token-scoped view
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/vendor/ticket/:token — public token-scoped view', () => {
  it('grants access to exactly the ticket the token was issued for, and nothing more', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendorTicket());

    const res = await request(app).get(`/api/v1/vendor/ticket/${VENDOR_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    // Lookup is by the token's hash only — the client cannot name a ticket.
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vendorAccessTokenHash: VENDOR_TOKEN_HASH }),
      })
    );
    const whereArg = (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty('id');
    expect(whereArg).not.toHaveProperty('societyId');

    // The limited view: job details only.
    expect(res.body.data.ticketRef).toBe('#T1TICKET');
    expect(res.body.data.title).toBe('Water leak in bathroom');
    expect(res.body.data.unitNumber).toBe('A-101');
    expect(res.body.data.vendorName).toBe('ABC Plumbing');
    expect(res.body.data.status).toBe('ASSIGNED');
    expect(res.body.data.allowedTransitions).toEqual(['IN_PROGRESS']);
    expect(res.body.data.photos).toEqual(['/api/v1/tickets/photo/leak-1.jpg']);

    // No resident / financial / internal data leaks through this view.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('Resident Person');
    expect(serialized).not.toContain('u-resident');
    expect(serialized).not.toContain('residentId');
    expect(serialized).not.toContain('residentName');
    expect(serialized).not.toContain('t1-ticket-uuid');
    expect(serialized).not.toContain(VENDOR_TOKEN_HASH);
    expect(serialized).not.toContain('rating');
  });

  it('rejects a well-formed token that matches no ticket (404)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/vendor/ticket/${'z'.repeat(43)}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('cannot reach a different ticket than it was issued for (404)', async () => {
    // A valid token is only ever looked up by its own hash. Pretend the hash
    // belongs to another ticket that isn't returned for this token.
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/vendor/ticket/${OTHER_TOKEN}`);

    expect(res.status).toBe(404);
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vendorAccessTokenHash: hashVendorAccessToken(OTHER_TOKEN) }),
      })
    );
    expect(JSON.stringify(res.body)).not.toContain('t1-ticket-uuid');
  });

  it('never even queries the database for a malformed token (404)', async () => {
    const res = await request(app).get('/api/v1/vendor/ticket/abc');

    expect(res.status).toBe(404);
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it('denies access once the ticket is CLOSED (404 + closed message)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorTicket({ status: 'CLOSED' })
    );

    const res = await request(app).get(`/api/v1/vendor/ticket/${VENDOR_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('closed');
  });

  it('denies access when the ticket is no longer assigned to a vendor (404)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorTicket({ assignedTo: null })
    );

    const res = await request(app).get(`/api/v1/vendor/ticket/${VENDOR_TOKEN}`);

    expect(res.status).toBe(404);
  });

  it('rate-limits repeated lookups with the same token (429)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendorTicket());

    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await request(app).get(`/api/v1/vendor/ticket/${VENDOR_TOKEN}`);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The vendor's only write: status transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/vendor/ticket/:token/status — vendor status updates', () => {
  it('moves ASSIGNED → IN_PROGRESS, attributing the change to the vendor', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendorTicket());
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorTicket({ status: 'IN_PROGRESS' })
    );

    const res = await request(app)
      .patch(`/api/v1/vendor/ticket/${VENDOR_TOKEN}/status`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.allowedTransitions).toEqual(['RESOLVED']);

    // Scoped update: only the resolved ticket, only the status field.
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1-ticket-uuid' }, data: { status: 'IN_PROGRESS' } })
    );

    // Audit attributes the actor as the vendor (no User account exists).
    const auditArg = (prisma.auditLog.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(auditArg.action).toBe('TICKET_STATUS_UPDATED_BY_VENDOR');
    expect(auditArg.actorUserId).toBeNull();
    expect(auditArg.societyId).toBe('s1');
    expect(auditArg.beforeJson).toEqual({ status: 'ASSIGNED' });
    expect(auditArg.afterJson).toMatchObject({
      status: 'IN_PROGRESS',
      vendor: 'ABC Plumbing',
      via: 'vendor_magic_link',
    });
  });

  it('moves IN_PROGRESS → RESOLVED', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorTicket({ status: 'IN_PROGRESS' })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorTicket({ status: 'RESOLVED' })
    );

    const res = await request(app)
      .patch(`/api/v1/vendor/ticket/${VENDOR_TOKEN}/status`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
  });

  it('will not let a vendor mark a ticket CLOSED (400, nothing written)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendorTicket());

    const res = await request(app)
      .patch(`/api/v1/vendor/ticket/${VENDOR_TOKEN}/status`)
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a skipped transition, e.g. ASSIGNED → RESOLVED (400)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendorTicket());

    const res = await request(app)
      .patch(`/api/v1/vendor/ticket/${VENDOR_TOKEN}/status`)
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('cannot be moved');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects a status update with an unknown token (404)', async () => {
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/v1/vendor/ticket/${OTHER_TOKEN}/status`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(404);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin-side triggers: issue, rotate, revoke
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/tickets/:id — vendor link lifecycle', () => {
  it('issues a hashed token and emails the magic link on assignment', async () => {
    mockAuth();
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ status: 'OPEN', assignedTo: null, vendorEmail: null })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ status: 'ASSIGNED', assignedTo: 'ABC Plumbing' })
    );
    emailSend.mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/api/v1/tickets/t1-ticket-uuid')
      .set('x-access-token', adminToken)
      .send({ assignedTo: 'ABC Plumbing', vendorEmail: 'vendor@example.com', status: 'ASSIGNED' });

    expect(res.status).toBe(200);
    expect(res.body.data.vendorLinkSent).toBe(true);

    // The emailed link carries a long, random token...
    expect(emailSend).toHaveBeenCalledTimes(1);
    const email = emailSend.mock.calls[0][0];
    expect(email.to).toBe('vendor@example.com');
    expect(email.subject).toContain('New job assigned');
    const match = email.html.match(/vendor\/ticket\/([A-Za-z0-9_-]+)/);
    expect(match).not.toBeNull();
    const rawToken = match![1];
    expect(rawToken.length).toBeGreaterThanOrEqual(32);

    // ...but only its SHA-256 hash is persisted.
    const updateData = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(updateData.vendorAccessTokenHash).toBe(sha256(rawToken));
    expect(updateData.vendorAccessTokenIssuedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(updateData)).not.toContain(rawToken);
  });

  it('rotates the token on reassignment, killing the previous vendor\'s link', async () => {
    mockAuth();
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ assignedTo: 'Old Vendor', vendorEmail: 'old@example.com', vendorAccessTokenHash: 'old-hash' })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ assignedTo: 'New Vendor', vendorEmail: 'new@example.com' })
    );
    emailSend.mockResolvedValue(undefined);

    const res = await request(app)
      .patch('/api/v1/tickets/t1-ticket-uuid')
      .set('x-access-token', adminToken)
      .send({ assignedTo: 'New Vendor', vendorEmail: 'new@example.com' });

    expect(res.status).toBe(200);

    const updateData = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    // A brand-new hash replaces the old one — the old link no longer resolves.
    expect(updateData.vendorAccessTokenHash).not.toBe('old-hash');
    expect(updateData.vendorAccessTokenHash).toMatch(/^[a-f0-9]{64}$/);

    // The new vendor is emailed; the old address must not be contacted.
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(emailSend.mock.calls[0][0].to).toBe('new@example.com');
  });

  it('never reuses the previous vendor\'s email when reassigning without one', async () => {
    mockAuth();
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ assignedTo: 'Old Vendor', vendorEmail: 'old@example.com', vendorAccessTokenHash: 'old-hash' })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ assignedTo: 'New Vendor', vendorEmail: null })
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1-ticket-uuid')
      .set('x-access-token', adminToken)
      .send({ assignedTo: 'New Vendor' });

    expect(res.status).toBe(200);
    expect(emailSend).not.toHaveBeenCalled();

    // No email to send to → no link, and the old one is revoked.
    const updateData = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(updateData.vendorAccessTokenHash).toBeNull();
    expect(updateData.vendorAccessTokenIssuedAt).toBeNull();
  });

  it('closing a ticket ends vendor access (no new link, and the link stops working)', async () => {
    mockAuth();
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ status: 'RESOLVED', assignedTo: 'ABC Plumbing' })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ status: 'CLOSED', closedAt: NOW })
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1-ticket-uuid')
      .set('x-access-token', adminToken)
      .send({ status: 'CLOSED', rating: 4 });

    expect(res.status).toBe(200);

    const updateData = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(updateData.status).toBe('CLOSED');
    expect(updateData.closedAt).toBeInstanceOf(Date);
    // Closing issues no new link and does not re-point the token — the CLOSED
    // status check is the authoritative gate, so the vendor is told the ticket
    // was closed rather than getting a bare "invalid link" error.
    expect(updateData.vendorAccessTokenHash).toBeUndefined();

    // ...and that link is indeed refused afterwards.
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      vendorTicket({ status: 'CLOSED' })
    );
    const vendorRes = await request(app).get(`/api/v1/vendor/ticket/${VENDOR_TOKEN}`);
    expect(vendorRes.status).toBe(404);
    expect(vendorRes.body.error.message).toContain('closed');
  });

  it('reports a failed vendor email honestly instead of a silent success (502)', async () => {
    mockAuth();
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ status: 'OPEN', assignedTo: null, vendorEmail: null })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      adminTicket({ status: 'ASSIGNED', assignedTo: 'ABC Plumbing' })
    );
    emailSend.mockRejectedValue(new Error('Gmail SMTP delivery failed: auth'));

    const res = await request(app)
      .patch('/api/v1/tickets/t1-ticket-uuid')
      .set('x-access-token', adminToken)
      .send({ assignedTo: 'ABC Plumbing', vendorEmail: 'vendor@example.com', status: 'ASSIGNED' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_SEND_FAILED');
    expect(res.body.data).toBeNull();
  });
});
