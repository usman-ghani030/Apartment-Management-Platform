import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';

// The webhook route queries the DB; mock prisma so these tests stay hermetic
// (the rest of the suite only exercises auth-rejection paths).
vi.mock('../lib/prisma', () => ({
  prisma: {
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    invoice: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    membership: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import app from '../app';
import { getPaymentProvider } from '../lib/payment-provider';
import { recordSuccessfulPayment } from '../lib/payment-processing';

const WEBHOOK_SECRET = 'test-webhook-secret-8c3f108cb9ba794799d9f7693eb9f59e';
const originalWebhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET;
const originalPub = process.env.SAFEPAY_PUBLIC_KEY;
const originalPriv = process.env.SAFEPAY_PRIVATE_KEY;

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
}

beforeAll(() => {
  // Simulate the merchant having configured Safepay + webhook secret.
  process.env.SAFEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.SAFEPAY_PUBLIC_KEY = 'sec_test_1234567890';
  process.env.SAFEPAY_PRIVATE_KEY = 'test-private-key';
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  if (originalWebhookSecret === undefined) delete process.env.SAFEPAY_WEBHOOK_SECRET;
  else process.env.SAFEPAY_WEBHOOK_SECRET = originalWebhookSecret;
  if (originalPub === undefined) delete process.env.SAFEPAY_PUBLIC_KEY;
  else process.env.SAFEPAY_PUBLIC_KEY = originalPub;
  if (originalPriv === undefined) delete process.env.SAFEPAY_PRIVATE_KEY;
  else process.env.SAFEPAY_PRIVATE_KEY = originalPriv;
});

describe('SafepayPaymentProvider.verifyWebhookSignature', () => {
  const provider = getPaymentProvider();

  it('accepts a valid HMAC-SHA512 signature over the raw body', () => {
    const body = JSON.stringify({ data: { tracker: 'abc123', state: 'TRACKER_ENDED' } });
    const signature = sign(body, WEBHOOK_SECRET);
    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('accepts a signature over a normalized (re-encoded) body, matching the PHP SDK behavior', () => {
    const body = '{"data":{"tracker":"abc123","state":"TRACKER_ENDED"}}';
    const signature = sign(JSON.stringify(JSON.parse(body)), WEBHOOK_SECRET);
    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects a signature generated with a different secret', () => {
    const body = JSON.stringify({ data: { tracker: 'abc123', state: 'TRACKER_ENDED' } });
    const signature = sign(body, 'wrong-secret');
    expect(provider.verifyWebhookSignature(body, signature)).toBe(false);
  });

  it('rejects when the webhook secret is not configured', () => {
    const body = JSON.stringify({ data: { tracker: 'abc123' } });
    const signature = sign(body, WEBHOOK_SECRET);
    const prev = process.env.SAFEPAY_WEBHOOK_SECRET;
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
    try {
      expect(provider.verifyWebhookSignature(body, signature)).toBe(false);
    } finally {
      process.env.SAFEPAY_WEBHOOK_SECRET = prev;
    }
  });
});

describe('POST /api/v1/payments/webhook', () => {
  it('rejects a request with no signature (400, no internal detail leaked)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .send({ data: { tracker: 'abc123', state: 'TRACKER_ENDED' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('rejects a request with an invalid signature', async () => {
    const body = JSON.stringify({ data: { tracker: 'abc123', state: 'TRACKER_ENDED' } });
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-sfpy-signature', sign(body, 'wrong-secret'))
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('acknowledges a validly-signed event for an unknown tracker without processing (idempotent-safe)', async () => {
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const body = JSON.stringify({ data: { tracker: 'unknown-tracker-xyz', state: 'TRACKER_ENDED' } });
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-sfpy-signature', sign(body, WEBHOOK_SECRET))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
    expect(prisma.payment.findUnique).toHaveBeenCalledWith({ where: { providerSessionId: 'unknown-tracker-xyz' } });
  });

  it('acknowledges a validly-signed ignored event (no tracker)', async () => {
    const body = JSON.stringify({ data: { state: 'SOMETHING_ELSE' } });
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-sfpy-signature', sign(body, WEBHOOK_SECRET))
      .send(body);
    expect(res.status).toBe(200);
  });
});

describe('recordSuccessfulPayment (atomic idempotency)', () => {
  it('claims the pending payment and marks the invoice paid exactly once', async () => {
    (prisma.payment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 1 });
    (prisma.invoice.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 1 });

    const result = await recordSuccessfulPayment({
      paymentId: 'p1', invoiceId: 'i1', societyId: 's1', amount: 5000, txnRef: 'tracker-1',
    });

    expect(result).toBe(true);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: 'pending' },
      data: expect.objectContaining({ status: 'succeeded' }),
    });
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', status: { not: 'PAID' } },
      data: { status: 'PAID' },
    });
  });

  it('is a no-op (no audit/notification) when the payment was already processed', async () => {
    (prisma.payment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 0 });

    const result = await recordSuccessfulPayment({
      paymentId: 'p1', invoiceId: 'i1', societyId: 's1', amount: 5000, txnRef: 'tracker-1',
    });

    expect(result).toBe(false);
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/invoices/:id/pay', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/api/v1/invoices/some-invoice-id/pay');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
