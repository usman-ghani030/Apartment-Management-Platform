import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    ticket: { findFirst: vi.fn(), update: vi.fn() },
    vendor: { findFirst: vi.fn() },
    society: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

// The assignment email must go through the shared provider (ADR 004) - mocked
// here so no SMTP transport is ever created in tests.
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import app from '../app';

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });

const NOW = new Date();

const VENDOR_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const VENDOR = {
  id: VENDOR_ID,
  societyId: 's1',
  name: 'Sunrise Plumbing',
  phone: '+923001234567',
  email: 'plumbing@example.com',
};

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1', societyId: 's1', unitId: null, residentId: 'u-resident',
    title: 'Kitchen leak', description: 'Sink leaking', category: 'plumbing',
    status: 'ASSIGNED', assignedTo: null, vendorId: null,
    vendorEmail: null, vendorAccessTokenHash: null, vendorAccessTokenIssuedAt: null,
    photosUrl: null, deletedAt: null,
    rating: null, ratingComment: null, ratedById: null, ratedAt: null,
    closedAt: null, createdAt: NOW, updatedAt: NOW,
    resident: { name: 'Resident' }, unit: null, ratedBy: null, vendor: null,
    _count: { comments: 0 },
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
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: userId, email: `${userId}@x.com`, name: userId,
  });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.society.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Sunrise Apartments' });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('PATCH /api/v1/tickets/:id - assigning a Vendor record', () => {
  it('stores vendorId + the vendor name snapshot and emails the existing magic link', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'OPEN', assignedTo: null, vendorId: null })
    );
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(VENDOR);
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(ticketRow({
        status: data.status ?? 'ASSIGNED',
        vendorId: data.vendorId,
        assignedTo: data.assignedTo,
        vendorEmail: data.vendorEmail,
        vendor: { id: VENDOR.id, name: VENDOR.name, phone: VENDOR.phone, email: VENDOR.email },
      }))
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ vendorId: VENDOR_ID, status: 'ASSIGNED' });

    expect(res.status).toBe(200);

    // The vendor was resolved tenant-scoped before anything was written.
    expect((prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({
      id: VENDOR_ID, societyId: 's1', deletedAt: null,
    });

    const data = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.vendorId).toBe(VENDOR_ID);
    // Name snapshot keeps the (name-grouped) vendor ratings working.
    expect(data.assignedTo).toBe('Sunrise Plumbing');
    // The vendor's on-file email is used for the job link without retyping it.
    expect(data.vendorEmail).toBe('plumbing@example.com');
    expect(data.vendorAccessTokenHash).toEqual(expect.any(String));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(mail.to).toBe('plumbing@example.com');

    // The response carries the id/phone (for the WhatsApp button) and the exact
    // link that went into the email - no second token is minted.
    expect(res.body.data.vendorId).toBe(VENDOR_ID);
    expect(res.body.data.vendorPhone).toBe('+923001234567');
    // Short display ref, same helper the vendor email/portal uses (the fixture
    // id is 't1', real ids are UUIDs - hence the short ref here).
    expect(res.body.data.ticketRef).toBe('#T1');

    const magicLink = res.body.data.vendorTicketUrl as string;
    expect(magicLink).toContain('/vendor/ticket/');
    expect(mail.text).toContain(magicLink.split('/vendor/ticket/')[1]);
  });

  it('rejects a vendor id from another society (or a soft-deleted vendor) with 400 and writes nothing', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(ticketRow());
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ vendorId: '00000000-0000-0000-0000-000000000009' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Vendor not found');
    expect(prisma.ticket.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID vendorId at the boundary', async () => {
    mockAuth('u-admin', adminMembership);

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ vendorId: 'v1' });

    expect(res.status).toBe(400);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('keeps the vendor record attached when only the status changes', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'ASSIGNED', vendorId: 'v1', assignedTo: 'Sunrise Plumbing' })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({
        status: 'IN_PROGRESS', vendorId: 'v1', assignedTo: 'Sunrise Plumbing',
        vendor: { id: VENDOR.id, name: VENDOR.name, phone: VENDOR.phone, email: VENDOR.email },
      })
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    const data = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.vendorId).toBeUndefined();
    expect(data.assignedTo).toBeUndefined();
    expect(res.body.data.vendorId).toBe('v1');
    // No reassignment, so no new link/email.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.body.data.vendorTicketUrl).toBeUndefined();
  });

  it('detaches the vendor record when a legacy free-text name is set instead', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'ASSIGNED', vendorId: 'v1', assignedTo: 'Sunrise Plumbing' })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'ASSIGNED', vendorId: null, assignedTo: 'Someone Else' })
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ assignedTo: 'Someone Else' });

    expect(res.status).toBe(200);
    const data = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.vendorId).toBeNull();
    expect(data.assignedTo).toBe('Someone Else');
    expect(res.body.data.vendorId).toBeNull();
  });

  it('still assigns by raw name alone (backwards compatible) - no vendor lookup, no vendorId', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'OPEN', assignedTo: null, vendorId: null })
    );
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'ASSIGNED', assignedTo: 'Legacy Vendor', vendorId: null })
    );

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ assignedTo: 'Legacy Vendor', status: 'ASSIGNED' });

    expect(res.status).toBe(200);
    expect(prisma.vendor.findFirst).not.toHaveBeenCalled();
    expect(res.body.data.vendorId).toBeNull();
    expect(res.body.data.assignedTo).toBe('Legacy Vendor');
  });

  it('forbids residents from assigning (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', residentToken)
      .send({ vendorId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(403);
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contact flexibility: a vendor needs *at least one* channel, so a phone-only
// vendor must still be assignable - and must never be recorded as emailed.
// ─────────────────────────────────────────────────────────────────────────────
const EMAIL_ONLY_VENDOR = { ...VENDOR, phone: null, email: 'plumbing@example.com' };
const PHONE_ONLY_VENDOR = { ...VENDOR, phone: '+923001234567', email: null };
const CONTACTLESS_VENDOR = { ...VENDOR, phone: null, email: null };

describe('PATCH /api/v1/tickets/:id - vendor contact flexibility', () => {
  /** Find the vendor, then echo back what the route wrote (as Prisma would). */
  function assignVendor(
    vendor: { id: string; name: string; phone: string | null; email: string | null }
  ) {
    (prisma.vendor.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(vendor);
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) =>
      Promise.resolve(ticketRow({
        status: data.status ?? 'ASSIGNED',
        vendorId: data.vendorId,
        assignedTo: data.assignedTo,
        vendorEmail: data.vendorEmail ?? null,
        vendor: { id: vendor.id, name: vendor.name, phone: vendor.phone, email: vendor.email },
      }))
    );
  }

  function assign() {
    return request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ vendorId: VENDOR_ID, status: 'ASSIGNED' });
  }

  it('emails an email-only vendor exactly as before (no phone needed)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'OPEN', assignedTo: null, vendorId: null })
    );
    assignVendor(EMAIL_ONLY_VENDOR);

    const res = await assign();

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0].to).toBe('plumbing@example.com');
    expect(res.body.data.vendorLinkSent).toBe(true);
    expect(res.body.data.vendorEmail).toBe('plumbing@example.com');
    // Nothing to link the WhatsApp button to, so the UI hides it.
    expect(res.body.data.vendorPhone).toBeNull();
  });

  it('skips the email for a phone-only vendor - assignment still succeeds, link still minted', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'OPEN', assignedTo: null, vendorId: null })
    );
    assignVendor(PHONE_ONLY_VENDOR);

    const res = await assign();

    // The assignment stands: no thrown error, no 502, nothing attempted.
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    // The society lookup only exists to render the email body.
    expect(prisma.society.findUnique).not.toHaveBeenCalled();

    const data = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.vendorId).toBe(VENDOR_ID);
    expect(data.assignedTo).toBe('Sunrise Plumbing');
    // Never advertise a channel the link was not sent to.
    expect(data.vendorEmail).toBeNull();
    expect(data.vendorAccessTokenHash).toEqual(expect.any(String));

    // The magic link is channel-independent: the raw token in the URL hashes to
    // exactly what was stored, so the manual WhatsApp hand-off really is the
    // same link the email would have carried (no second token).
    expect(res.body.data.vendorLinkSent).toBe(false);
    const url = res.body.data.vendorTicketUrl as string;
    expect(url).toContain('/vendor/ticket/');
    const rawToken = decodeURIComponent(url.split('/vendor/ticket/')[1]);
    expect(createHash('sha256').update(rawToken).digest('hex')).toBe(data.vendorAccessTokenHash);
    // This is what the WhatsApp button (wa.me) needs.
    expect(res.body.data.vendorPhone).toBe('+923001234567');
  });

  it('still assigns a vendor with neither channel, revoking any stale link instead of failing', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      ticketRow({ status: 'OPEN', assignedTo: null, vendorId: null })
    );
    assignVendor(CONTACTLESS_VENDOR);

    const res = await assign();

    // Unreachable by validation, but defensively: assign, issue nothing, warn via
    // the absent link rather than silently pretending a notification happened.
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    const data = (prisma.ticket.update as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(data.vendorId).toBe(VENDOR_ID);
    expect(data.vendorEmail).toBeNull();
    expect(data.vendorAccessTokenHash).toBeNull();
    expect(res.body.data.vendorTicketUrl).toBeUndefined();
    expect(res.body.data.vendorLinkSent).toBeUndefined();
  });
});
