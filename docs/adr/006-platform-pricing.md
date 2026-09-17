# ADR 006: Platform Pricing Model

**Status**: Accepted
**Date**: 2026-07-19

## Context
Needed a pricing model for charging societies to use the platform. Initial design was flat monthly tiers gated by a unit-count ceiling with different features per tier. Competitive research (Nizam, the closest direct Pakistan-market competitor) showed the market norm is per-unit pricing that scales with society size, not flat tiers - and flat tiers created two real problems: harsh cliffs at tier boundaries, and severe underpricing of the largest customers (a 2,000-unit complex would have paid the same flat fee as a 201-unit one).

## Decision
- **Every feature is available to every society, regardless of size or fee.** There is no feature-gating by plan - this removes the need for a feature-flag/entitlement system entirely. The only thing that varies by society size is the monthly fee.
- **Pricing is per-unit, calculated progressively** (like income tax brackets) - free under a threshold, then each unit is charged at the rate of the band it falls into, not a single rate applied to the whole count. This was corrected from an initial bracket-method design, which had a real flaw: at every band boundary, a society with slightly more units would pay less in total than one with slightly fewer, since the bracket method applied one flat rate to the entire unit count based on which band the total landed in. Progressive calculation is strictly increasing with unit count - no cliffs, no perverse incentive to under-report or shrink unit count.
- **Rate table, capped at 500 units**:

| Units | Rate |
|---|---|
| 1-15 | Free |
| 16-50 | Rs 20/unit/month (progressive) |
| 51-200 | Rs 12/unit/month (progressive) |
| 201-500 | Rs 8/unit/month (progressive) |
| 501+ | Custom quote - NOT auto-invoiced by formula |

  Example totals under progressive calculation: 50 units → Rs 700/month; 200 units → Rs 2,500/month; 500 units → Rs 4,900/month (the formulaic ceiling). Beyond 500 units, no invoice is auto-generated - the society is flagged for a manual sales conversation and custom pricing instead.
- **Billing is manual for now**: the platform generates a monthly invoice per society automatically (scheduled job, same BullMQ pattern as other recurring jobs), but the Committee Admin pays outside the app (bank transfer or similar) and a platform-side Super Admin marks the invoice paid once received. No auto-charge via Safepay yet.
- **This is entirely separate from resident dues.** The existing `Invoice`/payment system (Phase 2, Safepay) is for residents paying their society. This new platform billing is for societies paying the platform itself - different entity, different payer, different recipient, never to be confused or merged in the data model.

## Alternatives Considered
- **Flat tiers with feature gating** (original design): rejected - doesn't match market norm, creates unfair pricing at the extremes, and requires building a feature-entitlement system that adds real complexity for no benefit once the decision was made to give every society every feature.
- **Auto-billing via Safepay from day one**: appealing since the integration already exists, but deferred - manual billing is simpler to get right first, and given need real-world invoice volume and pricing validation before automating collection is worth doing carefully, not rushed alongside the pricing model itself changing.

## Consequences
- No feature-flag system needed anywhere in the app - simplifies the codebase meaningfully compared to the original tiered-features plan.
- Manual payment collection means no automatic enforcement (a society can't be locked out for non-payment without a human deciding to do so) - acceptable for now given low volume, but revisit once auto-billing is added.
- The per-unit rate table is a starting point, not a validated final price - expect to adjust it based on real prospect conversations; the architecture (invoice generated from a rate table + unit count) should make changing the numbers a config change, not a code change.
- When auto-billing is eventually added, it reuses the existing `PaymentProvider` (Safepay) abstraction from ADR 003 - the same integration, just a second use case (platform fee) alongside the first (resident dues).