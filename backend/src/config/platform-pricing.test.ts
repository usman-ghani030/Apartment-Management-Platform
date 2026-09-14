import { describe, it, expect } from 'vitest';
import {
  calculatePlatformFee,
  requiresCustomQuote,
  FREE_UNIT_THRESHOLD,
  PLATFORM_PRICING,
} from './platform-pricing';

/**
 * Progressive (income-tax style) pricing — ADR 006.
 * The worked examples are the spec's acceptance criteria.
 */
describe('calculatePlatformFee — worked examples from ADR 006', () => {
  it('50 units → Rs 700', () => {
    expect(calculatePlatformFee(50).totalRupees).toBe(700);
  });

  it('100 units → Rs 1,300 (15 free + 35×20 + 50×12, NOT 100×12)', () => {
    const calc = calculatePlatformFee(100);
    expect(calc.totalRupees).toBe(1300);
    // The breakdown must prove the progressive math, not a flat rate,
    // including the visible free band (transparency for the admin view).
    expect(calc.breakdown).toEqual([
      { label: 'Units 1–15', units: 15, ratePerUnit: 0, subtotal: 0 },
      { label: 'Units 16–50', units: 35, ratePerUnit: 20, subtotal: 700 },
      { label: 'Units 51–100', units: 50, ratePerUnit: 12, subtotal: 600 },
    ]);
  });

  it('200 units → Rs 2,500', () => {
    expect(calculatePlatformFee(200).totalRupees).toBe(2500);
  });

  it('500 units → Rs 4,900 (the formulaic ceiling)', () => {
    expect(calculatePlatformFee(500).totalRupees).toBe(4900);
  });

  it('free tier: ≤15 units cost nothing', () => {
    expect(calculatePlatformFee(0).totalRupees).toBe(0);
    expect(calculatePlatformFee(1).totalRupees).toBe(0);
    expect(calculatePlatformFee(15).totalRupees).toBe(0);
    expect(FREE_UNIT_THRESHOLD).toBe(15);
  });

  it('16 units → Rs 20 (first billable unit, smooth transition — no cliff)', () => {
    expect(calculatePlatformFee(16).totalRupees).toBe(20);
  });

  it('band boundaries charge the next unit at the next band rate', () => {
    // Unit 51 is the first unit in the Rs 12 band: 700 + 12.
    expect(calculatePlatformFee(51).totalRupees).toBe(712);
    // Unit 201 is the first unit in the Rs 8 band: 2500 + 8.
    expect(calculatePlatformFee(201).totalRupees).toBe(2508);
  });

  it('is strictly increasing for EVERY billable unit count 1..500 (no bracket-method cliffs)', () => {
    let previous = -1;
    for (let n = 1; n <= PLATFORM_PRICING.autoInvoiceCap; n++) {
      const total = calculatePlatformFee(n).totalRupees;
      expect(total).toBeGreaterThanOrEqual(previous);
      if (n > FREE_UNIT_THRESHOLD) {
        // Every unit beyond the free threshold adds strictly positive cost.
        expect(total).toBeGreaterThan(calculatePlatformFee(n - 1).totalRupees);
      }
      previous = total;
    }
    // Above the cap the formula stays at the ceiling — but 501+ societies are
    // never auto-invoiced (custom quote), so no cliff can leak into billing.
    expect(calculatePlatformFee(501).totalRupees).toBe(4900);
    expect(calculatePlatformFee(600).totalRupees).toBe(4900);
  });

  it('breakdown subtotals always sum to the total', () => {
    for (const n of [15, 16, 50, 51, 100, 200, 201, 349, 500]) {
      const calc = calculatePlatformFee(n);
      const sum = calc.breakdown.reduce((acc, b) => acc + b.subtotal, 0);
      expect(sum).toBe(calc.totalRupees);
    }
  });
});

describe('requiresCustomQuote', () => {
  it('flags only 501+', () => {
    expect(requiresCustomQuote(500)).toBe(false);
    expect(requiresCustomQuote(501)).toBe(true);
    expect(requiresCustomQuote(2000)).toBe(true);
  });

  it('config caps auto-invoicing at 500 units', () => {
    expect(PLATFORM_PRICING.autoInvoiceCap).toBe(500);
  });
});
