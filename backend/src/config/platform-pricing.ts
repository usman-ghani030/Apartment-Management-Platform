// ─────────────────────────────────────────────────────────────────────────────
// Platform pricing config (ADR 006) - societies paying the platform, NOT
// resident dues (Phase 2's Invoice system - different entity, payer, recipient;
// never merge them).
//
// Pricing is PROGRESSIVE (like income tax): the first 15 units are free for
// every society, then each unit is charged at the rate of the band it falls
// into. Not a bracket method (one rate for the whole count) - that design was
// rejected because a society with slightly more units could pay less overall
// at every band boundary. Progressive totals are strictly increasing.
//
// Rate changes are a CONFIG change, not a code change (expected per ADR 006
// while pricing is validated with real customers).
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingBand {
  /** Inclusive upper bound of this band's unit range (cumulative). */
  upTo: number;
  /** Rs per unit per month, charged only on units inside this band. */
  ratePerUnit: number;
}

export const PLATFORM_PRICING = {
  /** Bands are cumulative ranges [previousUpTo+1 .. upTo]. Must be sorted ascending. */
  bands: [
    { upTo: 15, ratePerUnit: 0 },
    { upTo: 50, ratePerUnit: 20 },
    { upTo: 200, ratePerUnit: 12 },
    { upTo: 500, ratePerUnit: 8 },
  ] as PricingBand[],

  /** Unit counts above this are never auto-invoiced - custom quote only. */
  autoInvoiceCap: 500,
} as const;

export const FREE_UNIT_THRESHOLD = PLATFORM_PRICING.bands[0].upTo; // 15

export interface BandLine {
  /** Band label, e.g. "Units 16–50". */
  label: string;
  /** Units billed inside this band. */
  units: number;
  ratePerUnit: number;
  /** Rs for this band (units × rate). */
  subtotal: number;
}

export interface ProgressiveCalculation {
  unitCount: number;
  totalRupees: number;
  breakdown: BandLine[];
}

/**
 * Progressive calculation. Example (100 units):
 *   first 15 free + 35 × Rs 20 (units 16–50) + 50 × Rs 12 (units 51–100)
 *   = Rs 1,300 - NOT 100 × Rs 12.
 *
 * Strictly increasing in unitCount: adding one unit never decreases the total.
 */
export function calculatePlatformFee(unitCount: number): ProgressiveCalculation {
  const bands = PLATFORM_PRICING.bands;
  const breakdown: BandLine[] = [];
  let previousUpTo = 0;
  let total = 0;

  for (const band of bands) {
    const unitsInBand = Math.max(0, Math.min(unitCount, band.upTo) - previousUpTo);
    const subtotal = unitsInBand * band.ratePerUnit;
    if (unitsInBand > 0) {
      const from = previousUpTo + 1;
      const to = Math.min(unitCount, band.upTo);
      breakdown.push({
        label: from === to ? `Unit ${from}` : `Units ${from}–${to}`,
        units: unitsInBand,
        ratePerUnit: band.ratePerUnit,
        subtotal,
      });
      total += subtotal;
    }
    previousUpTo = band.upTo;
    if (unitCount <= band.upTo) break;
  }

  return { unitCount, totalRupees: total, breakdown };
}

/** True when a society of this size must be quoted manually (501+). */
export function requiresCustomQuote(unitCount: number): boolean {
  return unitCount > PLATFORM_PRICING.autoInvoiceCap;
}
