import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Readable } from 'stream';

// Hermetic DB: mock prisma so these tests never touch a real database.
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
    invoice: { findFirst: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn(), updateMany: vi.fn() },
    paymentProof: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

// Storage is mocked too: these tests must never touch the real Cloudinary
// account. `confirmUpload` is what turns a client-supplied public id into a
// validated asset, and `openAssetStream` is what the gated screenshot route reads
// from - the folder/tenant rules themselves are covered in uploads.test.ts.
const storage = vi.hoisted(() => ({
  confirmUpload: vi.fn(),
  openAssetStream: vi.fn(),
  delete: vi.fn(),
  getSignedUploadParams: vi.fn(),
  getUrl: vi.fn(),
}));

vi.mock('../lib/storage', () => ({
  getStorageProvider: () => ({
    isConfigured: () => true,
    ...storage,
  }),
  tryGetStorageProvider: () => ({ isConfigured: () => true, ...storage }),
  setStorageProvider: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { AppError } from '../lib/app-error';
import app from '../app';

const PUBLIC_ID = 'omnihome/s1/payment-proofs/11111111-1111-4111-8111-111111111111/proof-abc123';
const confirmUpload = storage.confirmUpload;

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-fallback-access-secret';
const adminToken = jwt.sign({ userId: 'u-admin' }, SECRET, { expiresIn: '15m' });
const residentToken = jwt.sign({ userId: 'u-resident' }, SECRET, { expiresIn: '15m' });
const otherResidentToken = jwt.sign({ userId: 'u-other' }, SECRET, { expiresIn: '15m' });

const NOW = new Date();
const INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const PROOF_ID = '22222222-2222-4222-8222-222222222222';

const invoiceRow = {
  id: INVOICE_ID,
  societyId: 's1',
  unitId: 'u1',
  invoiceNumber: 'INV-20260101-0001-ABCD',
  title: 'Monthly maintenance dues',
  amount: 250000,
  status: 'ISSUED',
  paymentSource: null,
  dueDate: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  unit: { unitNumber: 'A-101' },
  payments: [] as { amount: number; status: string; paymentProofId?: string | null }[],
};

function proofRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PROOF_ID,
    societyId: 's1',
    invoiceId: INVOICE_ID,
    residentId: 'u-resident',
    screenshotUrl: 'proof-123-screenshot.png',
    claimedAmount: 250000,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'TX-1',
    status: 'PENDING',
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    resident: { name: 'Resident One' },
    reviewedBy: null,
    invoice: invoiceRow,
    ...overrides,
  };
}

const adminMembership = {
  id: 'm-admin', userId: 'u-admin', societyId: 's1', unitId: null,
  role: 'COMMITTEE_ADMIN', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
  // Also returned by the admin-notification lookup, which reads user.name/email.
  user: { name: 'Admin User', email: 'admin@x.com' },
};
const residentMembership = {
  id: 'm-res', userId: 'u-resident', societyId: 's1', unitId: 'u1',
  role: 'RESIDENT', status: 'ACTIVE', deletedAt: null,
  society: { name: 'Sunrise Apartments', slug: 'sunrise' },
  user: { name: 'Resident One', email: 'resident@x.com' },
};
const otherResidentMembership = {
  ...residentMembership,
  id: 'm-other', userId: 'u-other', unitId: 'u9',
  user: { name: 'Resident Two', email: 'resident2@x.com' },
};

function mockAuth(userId: string, membership: unknown) {
  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: userId, email: `${userId}@x.com`, name: userId,
  });
  (prisma.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([membership]);
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.invoice.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  (prisma.payment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  (prisma.paymentProof.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  (prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'pay-1' });
  confirmUpload.mockResolvedValue({
    url: `https://res.cloudinary.com/demo/image/upload/v1/${PUBLIC_ID}.png`,
    publicId: PUBLIC_ID,
    format: 'png',
    bytes: 2048,
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ── Submission (resident) ──────────────────────────────────────────────────
describe('POST /api/v1/invoices/:id/payment-proof', () => {
  it('creates a pending proof for the resident\u2019s own invoice, audits it and alerts admins', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(invoiceRow);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.paymentProof.create as ReturnType<typeof vi.fn>).mockResolvedValue(proofRow());

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', residentToken)
      .send({
        claimedAmount: '230000',
        paymentMethod: 'EASYPaisa'.toUpperCase(),
        transactionReference: ' EP-771 ',
        publicId: PUBLIC_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: PROOF_ID,
      status: 'PENDING',
      screenshotUrl: `/api/v1/payment-proofs/${PROOF_ID}/screenshot`,
    });

    const created = (prisma.paymentProof.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(created).toMatchObject({
      societyId: 's1',
      invoiceId: INVOICE_ID,
      residentId: 'u-resident',
      claimedAmount: 230000,
      paymentMethod: 'EASYPAISA',
      transactionReference: 'EP-771',
      status: 'PENDING',
    });
    // The stored value is the Cloudinary public id - never a URL the client could
    // read, and never a client-supplied string taken on trust.
    expect(created.screenshotUrl).toBe(PUBLIC_ID);

    // The asset was re-resolved against this society + invoice's own folder.
    expect(confirmUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: PUBLIC_ID,
        expectedFolder: `omnihome/s1/payment-proofs/${INVOICE_ID}`,
      })
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'PAYMENT_PROOF_SUBMITTED', entityType: 'payment_proof', entityId: PROOF_ID,
      }),
    }));
  });

  it('rejects a submission with no screenshot (400)', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(invoiceRow);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', residentToken)
      .send({ claimedAmount: 250000, paymentMethod: 'BANK_TRANSFER' });

    expect(res.status).toBe(400);
    expect(prisma.paymentProof.create).not.toHaveBeenCalled();
  });

  it('rejects a screenshot that the provider does not recognise (400)', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(invoiceRow);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    confirmUpload.mockRejectedValueOnce(new AppError('STORAGE_UPLOAD_INVALID', 400, 'That upload could not be found'));

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', residentToken)
      .send({ claimedAmount: 250000, paymentMethod: 'BANK_TRANSFER', publicId: PUBLIC_ID });

    expect(res.status).toBe(400);
    expect(prisma.paymentProof.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid amount or payment method at the boundary (400)', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(invoiceRow);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    for (const fields of [
      { claimedAmount: '0', paymentMethod: 'BANK_TRANSFER' },
      { claimedAmount: 'abc', paymentMethod: 'BANK_TRANSFER' },
      { claimedAmount: '250000', paymentMethod: 'BITCOIN' },
    ]) {
      const res = await request(app)
        .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
        .set('x-access-token', residentToken)
        .send({ ...fields, publicId: PUBLIC_ID });

      expect(res.status, JSON.stringify(fields)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(prisma.paymentProof.create).not.toHaveBeenCalled();
  });

  it('refuses a second pending proof on the same invoice (409)', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(invoiceRow);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(proofRow());

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', residentToken)
      .send({ claimedAmount: 250000, paymentMethod: 'BANK_TRANSFER', publicId: PUBLIC_ID });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already awaiting verification');
    expect(prisma.paymentProof.create).not.toHaveBeenCalled();
  });

  it('refuses an already-paid invoice (409)', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ ...invoiceRow, status: 'PAID' });

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', residentToken)
      .send({ claimedAmount: 250000, paymentMethod: 'BANK_TRANSFER', publicId: PUBLIC_ID });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already paid');
  });

  it('refuses a resident submitting against another unit\u2019s invoice (403)', async () => {
    mockAuth('u-other', otherResidentMembership);
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(invoiceRow);

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', otherResidentToken)
      .send({ claimedAmount: 250000, paymentMethod: 'BANK_TRANSFER', publicId: PUBLIC_ID });

    expect(res.status).toBe(403);
    expect(prisma.paymentProof.create).not.toHaveBeenCalled();
  });

  it('404s for an invoice in another society (tenant scoping)', async () => {
    mockAuth('u-resident', residentMembership);
    // The lookup is scoped by societyId, so a foreign invoice simply isn't found.
    (prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/invoices/${INVOICE_ID}/payment-proof`)
      .set('x-access-token', residentToken)
      .send({ claimedAmount: 250000, paymentMethod: 'BANK_TRANSFER', publicId: PUBLIC_ID });

    expect(res.status).toBe(404);
    expect((prisma.invoice.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toMatchObject({
      id: INVOICE_ID, societyId: 's1', deletedAt: null,
    });
  });
});

// ── Review: approve ───────────────────────────────────────────────────────
describe('POST /api/v1/payment-proofs/:id/approve', () => {
  it('marks the invoice paid through the shared payment pipeline, with paymentSource manual_proof', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(proofRow())
      .mockResolvedValueOnce(proofRow({
        status: 'APPROVED',
        reviewedById: 'u-admin',
        reviewedAt: NOW,
        reviewedBy: { name: 'Admin User' },
        invoice: { ...invoiceRow, status: 'PAID', paymentSource: 'manual_proof', payments: [{ amount: 250000, status: 'succeeded', paymentProofId: PROOF_ID }] },
      }));

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/approve`)
      .set('x-access-token', adminToken)
      .send({});

    expect(res.status).toBe(200);

    // Claimed atomically from PENDING (a second click can never double-pay).
    expect((prisma.paymentProof.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      where: { id: PROOF_ID, societyId: 's1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', reviewedById: 'u-admin' }),
    });

    // A real Payment row, provider-tagged and linked to the proof.
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        invoiceId: INVOICE_ID,
        societyId: 's1',
        amount: 250000,
        provider: 'manual_proof',
        paymentProofId: PROOF_ID,
        status: 'pending',
      }),
    }));

    // The shared mark-paid path ran: payment claimed, invoice PAID + source set.
    expect(prisma.payment.updateMany).toHaveBeenCalled();
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: INVOICE_ID, status: { not: 'PAID' } },
      data: { status: 'PAID', paymentSource: 'manual_proof' },
    }));

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_PROOF_APPROVED', entityId: PROOF_ID }),
    }));

    expect(res.body.data).toMatchObject({
      id: PROOF_ID,
      status: 'APPROVED',
      reviewedById: 'u-admin',
      invoiceStatus: 'PAID',
      // The proof's own payment is excluded from the outstanding figure, so a
      // correct proof does not suddenly look like a mismatch after approval.
      invoiceOutstandingAmount: 250000,
      amountMismatch: false,
    });
  });

  it('flags an amount mismatch instead of adjusting anything', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      proofRow({ claimedAmount: 100000 }) // invoice asks for 250000
    );

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/approve`)
      .set('x-access-token', adminToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.amountMismatch).toBe(true);
    expect(res.body.data.claimedAmount).toBe(100000);
    expect(res.body.data.invoiceOutstandingAmount).toBe(250000);
    // Paid as claimed - no auto-adjustment to the invoice amount.
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 100000 }),
    }));
  });

  it('refuses to review an already-reviewed proof (409) and writes nothing', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      proofRow({ status: 'APPROVED' })
    );

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/approve`)
      .set('x-access-token', adminToken)
      .send({});

    expect(res.status).toBe(409);
    expect(prisma.paymentProof.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('refuses to approve when the invoice was already paid (409) - no double credit', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      proofRow({ invoice: { ...invoiceRow, status: 'PAID' } })
    );

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/approve`)
      .set('x-access-token', adminToken)
      .send({});

    expect(res.status).toBe(409);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('404s for a proof in another society (tenant scoping)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/approve`)
      .set('x-access-token', adminToken)
      .send({});

    expect(res.status).toBe(404);
    expect((prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toMatchObject({
      id: PROOF_ID, societyId: 's1', deletedAt: null,
    });
  });

  it('forbids residents from approving (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/approve`)
      .set('x-access-token', residentToken)
      .send({});

    expect(res.status).toBe(403);
    expect(prisma.paymentProof.findFirst).not.toHaveBeenCalled();
  });
});

// ── Review: reject ────────────────────────────────────────────────────────
describe('POST /api/v1/payment-proofs/:id/reject', () => {
  it('rejects with a reason, audits it, leaves the invoice untouched', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(proofRow())
      .mockResolvedValueOnce(proofRow({
        status: 'REJECTED',
        reviewedById: 'u-admin',
        reviewedAt: NOW,
        rejectionReason: 'Screenshot is unreadable',
        reviewedBy: { name: 'Admin User' },
      }));

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/reject`)
      .set('x-access-token', adminToken)
      .send({ rejectionReason: 'Screenshot is unreadable' });

    expect(res.status).toBe(200);
    expect((prisma.paymentProof.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      where: { id: PROOF_ID, societyId: 's1', status: 'PENDING' },
      data: expect.objectContaining({
        status: 'REJECTED',
        reviewedById: 'u-admin',
        rejectionReason: 'Screenshot is unreadable',
      }),
    });

    // No payment, no invoice change: the resident can resubmit.
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_PROOF_REJECTED', entityId: PROOF_ID }),
    }));
    expect(res.body.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Screenshot is unreadable',
      reviewedById: 'u-admin',
    });
  });

  it('rejects a rejection with no reason at the boundary (400)', async () => {
    mockAuth('u-admin', adminMembership);

    for (const body of [{}, { rejectionReason: '' }, { rejectionReason: 'no' }]) {
      const res = await request(app)
        .post(`/api/v1/payment-proofs/${PROOF_ID}/reject`)
        .set('x-access-token', adminToken)
        .send(body);

      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(prisma.paymentProof.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to re-review an already reviewed proof (409)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      proofRow({ status: 'REJECTED' })
    );

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/reject`)
      .set('x-access-token', adminToken)
      .send({ rejectionReason: 'Again' });

    expect(res.status).toBe(409);
    expect(prisma.paymentProof.updateMany).not.toHaveBeenCalled();
  });

  it('forbids residents from rejecting (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .post(`/api/v1/payment-proofs/${PROOF_ID}/reject`)
      .set('x-access-token', residentToken)
      .send({ rejectionReason: 'Nope' });

    expect(res.status).toBe(403);
  });
});

// ── Review queue ──────────────────────────────────────────────────────────
describe('GET /api/v1/payment-proofs', () => {
  it('defaults to PENDING, scoped to the caller society, newest first', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([proofRow()]);

    const res = await request(app)
      .get('/api/v1/payment-proofs')
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    const args = (prisma.paymentProof.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.where).toEqual({ societyId: 's1', deletedAt: null, status: 'PENDING' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(21); // limit + 1, to detect another page
    expect(res.body.nextCursor).toBeNull();

    // Review context rides along, plus the mismatch flag.
    expect(res.body.data[0]).toMatchObject({
      id: PROOF_ID,
      residentName: 'Resident One',
      unitNumber: 'A-101',
      invoiceNumber: 'INV-20260101-0001-ABCD',
      invoiceOutstandingAmount: 250000,
      claimedAmount: 250000,
      amountMismatch: false,
      paymentMethod: 'BANK_TRANSFER',
    });
  });

  it('returns a nextCursor when there are more rows', async () => {
    mockAuth('u-admin', adminMembership);
    const rows = Array.from({ length: 3 }, (_, i) =>
      proofRow({ id: `p${i}`, createdAt: new Date(Date.now() - i * 1000) })
    );
    (prisma.paymentProof.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows);

    const res = await request(app)
      .get('/api/v1/payment-proofs?limit=2')
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.nextCursor).toBe(res.body.data[1].createdAt);
  });

  it('accepts an explicit status or ALL, and rejects a nonsense one (400)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await request(app).get('/api/v1/payment-proofs?status=ALL').set('x-access-token', adminToken);
    let args = (prisma.paymentProof.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.where.status).toBeUndefined();

    await request(app).get('/api/v1/payment-proofs?status=approved').set('x-access-token', adminToken);
    args = (prisma.paymentProof.findMany as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(args.where.status).toBe('APPROVED');

    const bad = await request(app).get('/api/v1/payment-proofs?status=NOPE').set('x-access-token', adminToken);
    expect(bad.status).toBe(400);
  });

  it('forbids residents from reading the queue (403)', async () => {
    mockAuth('u-resident', residentMembership);

    const res = await request(app)
      .get('/api/v1/payment-proofs')
      .set('x-access-token', residentToken);

    expect(res.status).toBe(403);
    expect(prisma.paymentProof.findMany).not.toHaveBeenCalled();
  });

  it('requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/payment-proofs');
    expect(res.status).toBe(401);
  });
});

// ── Screenshot delivery ───────────────────────────────────────────────────
describe('GET /api/v1/payment-proofs/:id/screenshot', () => {
  it('404s a proof from another society (tenant scoping)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/payment-proofs/${PROOF_ID}/screenshot`)
      .set('x-access-token', adminToken);

    expect(res.status).toBe(404);
  });

  it('forbids a different resident from reading someone else\u2019s screenshot (403)', async () => {
    mockAuth('u-other', otherResidentMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PROOF_ID, residentId: 'u-resident', screenshotUrl: PUBLIC_ID,
    });

    const res = await request(app)
      .get(`/api/v1/payment-proofs/${PROOF_ID}/screenshot`)
      .set('x-access-token', otherResidentToken);

    expect(res.status).toBe(403);
  });

  it('streams a Cloudinary-backed proof for the admin without exposing the provider URL', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PROOF_ID, residentId: 'u-resident', screenshotUrl: PUBLIC_ID,
    });
    storage.openAssetStream.mockResolvedValue({
      stream: Readable.from([Buffer.from('png-bytes')]),
      contentType: 'image/png',
      contentLength: 9,
    });

    const res = await request(app)
      .get(`/api/v1/payment-proofs/${PROOF_ID}/screenshot`)
      .set('x-access-token', adminToken);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(storage.openAssetStream).toHaveBeenCalledWith(PUBLIC_ID);
  });

  it('lets the submitting resident read their own proof', async () => {
    mockAuth('u-resident', residentMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PROOF_ID, residentId: 'u-resident', screenshotUrl: PUBLIC_ID,
    });
    storage.openAssetStream.mockResolvedValue({
      stream: Readable.from([Buffer.from('png-bytes')]),
      contentType: 'image/png',
    });

    const res = await request(app)
      .get(`/api/v1/payment-proofs/${PROOF_ID}/screenshot`)
      .set('x-access-token', residentToken);

    expect(res.status).toBe(200);
  });

  it('404s a missing legacy on-disk file (admin of the society)', async () => {
    mockAuth('u-admin', adminMembership);
    (prisma.paymentProof.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: PROOF_ID, residentId: 'u-resident', screenshotUrl: 'does-not-exist.png',
    });

    const res = await request(app)
      .get(`/api/v1/payment-proofs/${PROOF_ID}/screenshot`)
      .set('x-access-token', adminToken);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('not found on disk');
    // A bare filename is never handed to the provider.
    expect(storage.openAssetStream).not.toHaveBeenCalled();
  });
});
