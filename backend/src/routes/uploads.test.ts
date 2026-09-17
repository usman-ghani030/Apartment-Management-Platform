import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Signed upload endpoints (ADR 002). Hermetic: prisma and the storage provider
 * are both mocked, so nothing here reaches Postgres or Cloudinary.
 *
 * What these cover is the part that is ours to get wrong - who may ask for a
 * signature for what, which folder they get, and that confirm/delete cannot be
 * aimed at another tenant's assets.
 */

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    ticket: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const storage = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  getSignedUploadParams: vi.fn(),
  confirmUpload: vi.fn(),
  getUrl: vi.fn(),
  openAssetStream: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../lib/storage', () => ({
  getStorageProvider: () => storage,
  tryGetStorageProvider: () => storage,
  setStorageProvider: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import app from '../app';

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });
const otherResidentToken = jwt.sign({ userId: 'u-other' }, SECRET, { expiresIn: '15m' });

const TICKET_ID = '33333333-3333-4333-8333-333333333333';
const INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const TICKET_FOLDER = `omnihome/s1/tickets/${TICKET_ID}`;
const PROOF_FOLDER = `omnihome/s1/payment-proofs/${INVOICE_ID}`;

const adminMembership = {
  id: 'm-admin', userId: 'u-admin', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
  user: { name: 'Admin User', email: 'admin@x.com' },
};
const residentMembership = {
  id: 'm-res', userId: 'u-resident', societyId: 's1', unitId: 'unit-1',
  role: 'RESIDENT', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
  user: { name: 'Resident One', email: 'resident@x.com' },
};
const otherResidentMembership = {
  ...residentMembership,
  id: 'm-other', userId: 'u-other', unitId: 'unit-9',
  user: { name: 'Resident Two', email: 'resident2@x.com' },
};

/**
 * Make the mocked auth layer resolve to this membership for a request. With no
 * `x-society-id` header, `loadMembership` auto-detects from a single active
 * membership - which is exactly how these tests exercise the session's society.
 */
interface TestMembership {
  userId: string;
  societyId: string;
  unitId: string | null;
  role: string;
  user: { name: string; email: string };
}

function mockAuth(membership: TestMembership) {
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
  (prisma.membership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(membership);
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    status: 'ACTIVE',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
  storage.getSignedUploadParams.mockImplementation((input: { folder: string }) => ({
    uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
    cloudName: 'demo',
    apiKey: 'key',
    timestamp: 1_700_000_000,
    signature: 'sig',
    folder: input.folder,
    allowedFormats: 'jpg,jpeg,png,webp,gif',
    maxFileSizeBytes: 10 * 1024 * 1024,
    resourceType: 'image',
    publicIdPrefix: `${input.folder}/`,
  }));
  storage.confirmUpload.mockResolvedValue({
    url: `https://res.cloudinary.com/demo/image/upload/v1/${TICKET_FOLDER}/abc.png`,
    publicId: `${TICKET_FOLDER}/abc`,
    format: 'png',
    bytes: 1024,
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ── POST /api/v1/uploads/signature ─────────────────────────────────────────
describe('POST /api/v1/uploads/signature', () => {
  it('signs a folder built from the session society, not the client', async () => {
    mockAuth(residentMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TICKET_ID, residentId: 'u-resident',
    });

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('x-access-token', residentToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.folder).toBe(TICKET_FOLDER);
    // No secret, ever.
    expect(JSON.stringify(res.body)).not.toContain('secret');

    expect(storage.getSignedUploadParams).toHaveBeenCalledWith(
      expect.objectContaining({ folder: TICKET_FOLDER })
    );
    // The ticket lookup is tenant-scoped.
    expect((prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toMatchObject({
      id: TICKET_ID, societyId: 's1', deletedAt: null,
    });
  });

  it('ignores a client-supplied societyId (folder always comes from the session)', async () => {
    mockAuth(adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TICKET_ID, residentId: 'u-x' });

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('x-access-token', adminToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, societyId: 's-other' });

    expect(res.status).toBe(200);
    expect(res.body.data.folder.startsWith('omnihome/s1/')).toBe(true);
  });

  it('404s a ticket in another society (tenant scoping)', async () => {
    mockAuth(adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('x-access-token', adminToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID });

    expect(res.status).toBe(404);
    expect(storage.getSignedUploadParams).not.toHaveBeenCalled();
  });

  it('forbids a resident asking for a signature against someone else\u2019s ticket (403)', async () => {
    mockAuth(otherResidentMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: TICKET_ID, residentId: 'u-resident',
    });

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('x-access-token', otherResidentToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID });

    expect(res.status).toBe(403);
    expect(storage.getSignedUploadParams).not.toHaveBeenCalled();
  });

  it('rejects an unknown purpose at the boundary (400)', async () => {
    mockAuth(adminMembership);

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('x-access-token', adminToken)
      .send({ purpose: 'society-logo', resourceId: TICKET_ID });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication (401)', async () => {
    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID });

    expect(res.status).toBe(401);
  });

  it('scopes a payment proof signature to the invoice, with the invoice owner\u2019s unit check', async () => {
    mockAuth(residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: INVOICE_ID, unitId: 'unit-1' });

    const res = await request(app)
      .post('/api/v1/uploads/signature')
      .set('x-access-token', residentToken)
      .send({ purpose: 'payment-proof', resourceId: INVOICE_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.folder).toBe(PROOF_FOLDER);
    expect(res.body.data.maxFileSizeBytes).toBe(10 * 1024 * 1024);
  });
});

// ── POST /api/v1/uploads/confirm ───────────────────────────────────────────
describe('POST /api/v1/uploads/confirm', () => {
  it('confirms an asset under the folder the session was signed and audits it', async () => {
    mockAuth(adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TICKET_ID, residentId: 'u-resident' });

    const res = await request(app)
      .post('/api/v1/uploads/confirm')
      .set('x-access-token', adminToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId: `${TICKET_FOLDER}/abc` });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      publicId: `${TICKET_FOLDER}/abc`,
      format: 'png',
      bytes: 1024,
      resourceType: 'tickets',
    });
    expect(storage.confirmUpload).toHaveBeenCalledWith(
      expect.objectContaining({ expectedFolder: TICKET_FOLDER })
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPLOAD_CONFIRMED', entityType: 'ticket', entityId: TICKET_ID,
        }),
      })
    );
  });

  it('rejects a public id outside the expected folder (400)', async () => {
    mockAuth(adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TICKET_ID, residentId: 'u-resident' });
    storage.confirmUpload.mockRejectedValueOnce(
      new AppError(
        ErrorCodes.STORAGE_UPLOAD_INVALID,
        400,
        'That upload does not belong to the record you are attaching it to'
      )
    );

    const res = await request(app)
      .post('/api/v1/uploads/confirm')
      .set('x-access-token', adminToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId: 'omnihome/s2/tickets/other/abc' });

    expect(res.status).toBe(400);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('is not a way to confirm against a ticket you cannot reach (404)', async () => {
    mockAuth(otherResidentMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TICKET_ID, residentId: 'u-resident' });

    const res = await request(app)
      .post('/api/v1/uploads/confirm')
      .set('x-access-token', otherResidentToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId: `${TICKET_FOLDER}/abc` });

    expect(res.status).toBe(403);
    expect(storage.confirmUpload).not.toHaveBeenCalled();
  });

  it('rejects a malformed publicId at the boundary (400)', async () => {
    mockAuth(adminMembership);
    (prisma.ticket.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: TICKET_ID, residentId: 'u-resident' });

    for (const publicId of ['', '/absolute/path', `${TICKET_FOLDER}/../escape`, 'trailing/']) {
      const res = await request(app)
        .post('/api/v1/uploads/confirm')
        .set('x-access-token', adminToken)
        .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId });

      expect(res.status, publicId).toBe(400);
    }
    expect(storage.confirmUpload).not.toHaveBeenCalled();
  });
});

// ── DELETE /api/v1/uploads/asset ───────────────────────────────────────────
describe('DELETE /api/v1/uploads/asset', () => {
  it('lets an admin remove an asset inside their own society folder', async () => {
    mockAuth(adminMembership);

    const res = await request(app)
      .delete('/api/v1/uploads/asset')
      .set('x-access-token', adminToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId: `${TICKET_FOLDER}/abc` });

    expect(res.status).toBe(200);
    expect(storage.delete).toHaveBeenCalledWith(`${TICKET_FOLDER}/abc`);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'UPLOAD_DELETED' }) })
    );
  });

  it('refuses an asset in another society\u2019s folder (403)', async () => {
    mockAuth(adminMembership);

    const res = await request(app)
      .delete('/api/v1/uploads/asset')
      .set('x-access-token', adminToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId: `omnihome/s2/tickets/${TICKET_ID}/abc` });

    expect(res.status).toBe(403);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('is admin-only - a resident cannot delete stored files (403)', async () => {
    mockAuth(residentMembership);

    const res = await request(app)
      .delete('/api/v1/uploads/asset')
      .set('x-access-token', residentToken)
      .send({ purpose: 'ticket-photo', resourceId: TICKET_ID, publicId: `${TICKET_FOLDER}/abc` });

    expect(res.status).toBe(403);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
