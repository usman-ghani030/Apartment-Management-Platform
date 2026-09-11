import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    notice: { create: vi.fn() },
    ticket: { findFirst: vi.fn(), update: vi.fn() },
    ticketComment: { create: vi.fn() },
    document: { findFirst: vi.fn(), update: vi.fn() },
    visitorPass: { findFirst: vi.fn(), update: vi.fn() },
    gateLog: { create: vi.fn() },
    unit: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import app from '../app';

// app's dotenv.config() has run by now, so this matches what verifyAccessToken uses.
const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });
const guardToken = jwt.sign({ userId: 'u-guard' }, SECRET, { expiresIn: '15m' });

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
const guardMembership = {
  id: 'm-guard', userId: 'u-guard', societyId: 's1', unitId: null,
  role: 'SECURITY_GUARD', status: 'ACTIVE', deletedAt: null,
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

describe('validation hardening — auth schemas', () => {
  it('rejects a signup password longer than 128 characters (400)', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({
      email: 'a@b.com',
      password: 'x'.repeat(129),
      name: 'Test User',
      societyName: 'Test Society',
      societySlug: 'test-society',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a signup society name over 100 characters (400)', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({
      email: 'a@b.com',
      password: 'password123',
      name: 'Test User',
      societyName: 'X'.repeat(101),
      societySlug: 'test-society',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('100 characters');
  });
});

describe('validation hardening — notices', () => {
  it('rejects notice content over 10,000 characters (400, no DB write)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .post('/api/v1/notices')
      .set('x-access-token', adminToken)
      .send({ title: 'Hi', content: 'y'.repeat(10001), category: 'general' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.notice.create).not.toHaveBeenCalled();
  });

  it('rejects a notice whose targetUnitIds contain a non-UUID (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .post('/api/v1/notices')
      .set('x-access-token', adminToken)
      .send({ title: 'Hi', content: 'Body', category: 'general', targetType: 'SPECIFIC_UNITS', targetUnitIds: ['not-a-uuid'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validation hardening — tickets & comments', () => {
  it('rejects a ticket description over 5,000 characters (400)', async () => {
    mockAuth('u-resident', residentMembership);
    const res = await request(app)
      .post('/api/v1/tickets')
      .set('x-access-token', residentToken)
      .send({ title: 'Leak', description: 'd'.repeat(5001), category: 'plumbing' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a ticket update description over 5,000 characters (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .patch('/api/v1/tickets/t1')
      .set('x-access-token', adminToken)
      .send({ description: 'd'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a ticket comment over 2,000 characters (400)', async () => {
    mockAuth('u-resident', residentMembership);
    const res = await request(app)
      .post('/api/v1/tickets/t1/comments')
      .set('x-access-token', residentToken)
      .send({ content: 'c'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });
});

describe('validation hardening — units', () => {
  it('rejects a unit with floor above 500 (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .post('/api/v1/units')
      .set('x-access-token', adminToken)
      .send({ buildingId: '11111111-1111-1111-1111-111111111111', unitNumber: 'A1', floor: 501, type: 'VACANT' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Floor');
    expect(prisma.unit.create).not.toHaveBeenCalled();
  });

  it('rejects a unit with a negative floor (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .post('/api/v1/units')
      .set('x-access-token', adminToken)
      .send({ buildingId: '11111111-1111-1111-1111-111111111111', unitNumber: 'A1', floor: -1, type: 'VACANT' });
    expect(res.status).toBe(400);
  });

  it('rejects a unit with an invalid primary-contact email (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .post('/api/v1/units')
      .set('x-access-token', adminToken)
      .send({
        buildingId: '11111111-1111-1111-1111-111111111111', unitNumber: 'A1', floor: 1, type: 'VACANT',
        primaryContactEmail: 'not-an-email',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('email');
  });
});

describe('validation hardening — documents', () => {
  const docRow = {
    id: 'd1', societyId: 's1', folderId: null, name: 'bylaws.pdf',
    description: null, fileUrl: '123-bylaws.pdf', fileSize: 100, mimeType: 'application/pdf',
    uploadedBy: 'u-admin', createdAt: new Date(), updatedAt: new Date(),
    folder: null, uploader: { id: 'u-admin', name: 'Admin', email: 'a@x.com' },
  };

  it('rejects a document metadata update with a non-UUID folderId (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .patch('/api/v1/documents/d1')
      .set('x-access-token', adminToken)
      .send({ folderId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an empty document name on update (400)', async () => {
    mockAuth('u-admin', adminMembership);
    const res = await request(app)
      .patch('/api/v1/documents/d1')
      .set('x-access-token', adminToken)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid document rename (200)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.document.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(docRow);
    (prisma.document.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...docRow, name: 'renamed.pdf' });

    const res = await request(app)
      .patch('/api/v1/documents/d1')
      .set('x-access-token', adminToken)
      .send({ name: 'renamed.pdf' });

    expect(res.status).toBe(200);
    expect(prisma.document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'd1' },
      data: expect.objectContaining({ name: 'renamed.pdf' }),
    }));
    expect(res.body.data.name).toBe('renamed.pdf');
  });
});

describe('validation hardening — visitor gate log', () => {
  it('rejects a gate action that is not ENTRY/EXIT (400)', async () => {
    mockAuth('u-guard', guardMembership);
    const res = await request(app)
      .post('/api/v1/visitors/vp1/gate')
      .set('x-access-token', guardToken)
      .send({ action: 'WAVE', notes: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('ENTRY or EXIT');
    expect(prisma.visitorPass.findFirst).not.toHaveBeenCalled();
  });

  it('rejects gate notes over 500 characters (400)', async () => {
    mockAuth('u-guard', guardMembership);
    const res = await request(app)
      .post('/api/v1/visitors/vp1/gate')
      .set('x-access-token', guardToken)
      .send({ action: 'ENTRY', notes: 'n'.repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs a valid ENTRY for an approved pass (201)', async () => {
    mockAuth('u-guard', guardMembership);
    (prisma.visitorPass.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'vp1', societyId: 's1', unitId: 'u1', status: 'APPROVED',
      visitorName: 'Bob', unit: { unitNumber: '101' }, deletedAt: null, expiresAt: new Date(Date.now() + 10000),
    });
    (prisma.gateLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'g1', societyId: 's1', visitorPassId: 'vp1', unitId: 'u1',
      action: 'ENTRY', guardId: 'u-guard', notes: 'Arrived by car', createdAt: new Date(),
    });
    (prisma.visitorPass.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/visitors/vp1/gate')
      .set('x-access-token', guardToken)
      .send({ action: 'ENTRY', notes: 'Arrived by car' });

    expect(res.status).toBe(201);
    expect(res.body.data.action).toBe('ENTRY');
    expect(res.body.data.notes).toBe('Arrived by car');
    expect(prisma.gateLog.create).toHaveBeenCalled();
  });
});

describe('validation hardening — photo file serving (path traversal)', () => {
  it('rejects a ticket photo filename that escapes the upload dir (400)', async () => {
    const res = await request(app).get('/api/v1/tickets/photo/..%2F..%2F.env');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a parcel photo filename that escapes the upload dir (400)', async () => {
    const res = await request(app).get('/api/v1/parcels/photo/..%2F..%2F.env');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
