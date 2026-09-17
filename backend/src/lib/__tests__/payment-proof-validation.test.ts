import { describe, it, expect } from 'vitest';
import {
  CreatePaymentProofSchema,
  RejectPaymentProofSchema,
  PaymentMethodValues,
} from '@apartment/shared';

const PUBLIC_ID = 'omnihome/s1/payment-proofs/inv-1/proof-abc123';

/**
 * Boundary validation for manual payment proofs (ADR 008).
 *
 * The screenshot is no longer part of this payload: it is uploaded straight to
 * Cloudinary (ADR 002) and referenced here by public id. The API re-resolves that
 * id server-side, so the client never supplies a URL. `claimedAmount` still
 * accepts a string because the form may send one, and gets coerced to paisa.
 */
describe('CreatePaymentProofSchema', () => {
  it('accepts a submission and coerces a string amount to paisa', () => {
    const result = CreatePaymentProofSchema.safeParse({
      claimedAmount: '250000',
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'TX-99812',
      publicId: PUBLIC_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.claimedAmount).toBe(250000);
      expect(result.data.paymentMethod).toBe('BANK_TRANSFER');
      expect(result.data.transactionReference).toBe('TX-99812');
      expect(result.data.publicId).toBe(PUBLIC_ID);
    }
  });

  it('accepts every valid payment method', () => {
    for (const method of PaymentMethodValues) {
      const result = CreatePaymentProofSchema.safeParse({
        claimedAmount: 100,
        paymentMethod: method,
        publicId: PUBLIC_ID,
      });
      expect(result.success, method).toBe(true);
    }
  });

  it('requires a screenshot publicId', () => {
    for (const publicId of [undefined, '', '   ']) {
      const result = CreatePaymentProofSchema.safeParse({
        claimedAmount: 250000,
        paymentMethod: 'BANK_TRANSFER',
        publicId,
      });
      expect(result.success, String(publicId)).toBe(false);
    }
  });

  it('rejects an absurdly long publicId', () => {
    const result = CreatePaymentProofSchema.safeParse({
      claimedAmount: 250000,
      paymentMethod: 'BANK_TRANSFER',
      publicId: `omnihome/s1/${'x'.repeat(400)}`,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a zero, negative, non-numeric or missing amount', () => {
    for (const claimedAmount of ['0', '-100', 'abc', '', undefined]) {
      const result = CreatePaymentProofSchema.safeParse({
        claimedAmount,
        paymentMethod: 'EASYPAISA',
        publicId: PUBLIC_ID,
      });
      expect(result.success, String(claimedAmount)).toBe(false);
    }
  });

  it('rejects a fractional paisa amount (money is integer paisa)', () => {
    const result = CreatePaymentProofSchema.safeParse({
      claimedAmount: 100.5,
      paymentMethod: 'EASYPAISA',
      publicId: PUBLIC_ID,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown payment method', () => {
    const result = CreatePaymentProofSchema.safeParse({
      claimedAmount: 100,
      paymentMethod: 'BITCOIN',
      publicId: PUBLIC_ID,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an over-long transaction reference', () => {
    const result = CreatePaymentProofSchema.safeParse({
      claimedAmount: 100,
      paymentMethod: 'OTHER',
      transactionReference: 'x'.repeat(101),
      publicId: PUBLIC_ID,
    });
    expect(result.success).toBe(false);
  });

  it('allows a missing or empty transaction reference', () => {
    expect(
      CreatePaymentProofSchema.safeParse({ claimedAmount: 100, paymentMethod: 'OTHER', publicId: PUBLIC_ID }).success
    ).toBe(true);
    expect(
      CreatePaymentProofSchema.safeParse({
        claimedAmount: 100, paymentMethod: 'OTHER', transactionReference: '', publicId: PUBLIC_ID,
      }).success
    ).toBe(true);
  });
});

describe('RejectPaymentProofSchema', () => {
  it('requires a reason', () => {
    expect(RejectPaymentProofSchema.safeParse({}).success).toBe(false);
    expect(RejectPaymentProofSchema.safeParse({ rejectionReason: '' }).success).toBe(false);
    expect(RejectPaymentProofSchema.safeParse({ rejectionReason: '  ' }).success).toBe(false);
  });

  it('rejects a one-character reason', () => {
    expect(RejectPaymentProofSchema.safeParse({ rejectionReason: 'no' }).success).toBe(false);
  });

  it('accepts and trims a real reason', () => {
    const result = RejectPaymentProofSchema.safeParse({
      rejectionReason: '  Screenshot is unreadable  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rejectionReason).toBe('Screenshot is unreadable');
  });

  it('rejects a reason over 500 characters', () => {
    const result = RejectPaymentProofSchema.safeParse({ rejectionReason: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});
