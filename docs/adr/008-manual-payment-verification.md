# ADR 008: Manual Payment Verification (Screenshot Proof-of-Payment)

## Status

Accepted

Numbering note: the implementation request referenced this decision as "ADR 007",
but 007 is already taken by the vendor entity decision (see
`007-vendor-entity.md`), so this ADR is 008 and the request's reference to 007 was
a typo. The decision text below is unchanged from when it was accepted.

## Context

Safepay (ADR 003) covers card/hosted-checkout payments, but a large share of residents in the Pakistan market pay dues via bank transfer, Easypaisa, or JazzCash outside any gateway, then need a way to prove they've paid. Today there is no path for this — residents have no way to report an off-platform payment, and admins have no queue to verify one. This gap pushes residents back toward WhatsApp/paper, which is exactly what OmniHome is meant to replace.

## Decision

Add a manual payment verification flow, kept as a **separate subsystem from `PaymentProvider`**, not an extension of it.

`PaymentProvider` exists specifically to abstract gateways that confirm payment programmatically (webhook-driven). A screenshot upload has no automated confirmation — a human admin must review and decide. Forcing it through the same interface would misrepresent what that abstraction is for. Instead:

- A new `PaymentProof` entity captures the resident's claim (screenshot, amount, method, optional reference), independent of `Invoice`.
- Screenshot storage reuses the existing `StorageProvider` (Cloudinary) abstraction — no new storage code.
- Admin review is a manual approve/reject action, audited via the existing `logAudit()` infrastructure, same as every other financial mutation in the system.
- On approval, the underlying `Invoice`/payment record is marked paid with `source: manual_proof`, so reconciliation and analytics can treat gateway and manual-proof payments uniformly at the reporting layer, even though they're captured through different subsystems.

Fraud/authenticity control for v1 is human review only — no OCR, duplicate-detection, or automated anomaly checks. That is explicitly deferred to Phase 10 (AI layer), where anomaly detection is already planned.

## Consequences

**Positive**
- Covers the payment method most residents will actually reach for first in this market.
- Keeps `PaymentProvider` semantically clean (gateway-confirmed payments only).
- Reuses existing storage, audit, notification, and RBAC infrastructure — no new cross-cutting systems.
- Reporting layer stays unified via a `source` discriminator rather than needing merged queries across two payment models.

**Negative / accepted trade-offs**
- Introduces a manual admin workload (review queue) that doesn't exist for gateway payments.
- No automated fraud detection at launch — reused/mismatched screenshots rely entirely on admin diligence until Phase 10.
- Amount-mismatch handling (claimed vs. invoiced) is surfaced to the admin rather than resolved automatically; no partial-payment logic is introduced by this feature.

## Alternatives considered

- **Extend `PaymentProvider` with a "manual" implementation** — rejected. The interface's contract implies programmatic confirmation; a manual review flow doesn't fit that contract and would need provider methods that don't make sense for real gateways (e.g. "confirm" as a human action instead of a webhook).
- **OCR-based auto-verification at launch** — rejected for v1 as premature; no evidence yet of scale that justifies it, and it belongs with the other AI-driven features already scoped for Phase 10.

## Implementation notes (added 2026-09-17, when the slice was built)

These record where the built code had to pin down something the decision above
left open, including two places where the codebase differs from what the
original text assumed. Nothing above was rewritten.

1. **Screenshot storage: the `StorageProvider` abstraction does not exist yet.**
   ADR 002 chose Cloudinary, but documents and parcel/ticket photos are still
   written to `backend/uploads/`, and there is no `StorageProvider` interface in
   the codebase to reuse. Proof screenshots therefore use the same existing
   upload pattern (multer disk storage, image MIME allowlist, sanitized
   filename) into `backend/uploads/payment-proofs/`, and
   `PaymentProof.screenshotUrl` stores the sanitized on-disk filename with the
   API returning a computed URL (`/api/v1/payment-proofs/:id/screenshot`, the
   same way `Document` returns a computed `fileUrl`). Unlike parcel/ticket
   photos, which are served by filename to anyone, proof screenshots are
   financial evidence and are served only to admins of that society or the
   resident who submitted them.

   *Superseded (2026-09-17) by the ADR 002 implementation:* proof screenshots now
   upload straight from the browser to Cloudinary with a server-issued signature,
   and `screenshotUrl` holds the Cloudinary **public id** instead of a disk
   filename. The rule above is unchanged and still enforced by the same endpoint -
   because a Cloudinary delivery URL is publicly readable on this account, the
   route now streams the bytes through the API rather than handing the browser a
   provider URL. The multer disk path is kept only to serve proofs submitted
   before the move.
2. **`claimedAmount` is `Int` in paisa**, matching `Invoice.amount` and
   `Payment.amount`, not a `Decimal`. All money in this codebase is integer
   paisa to avoid floating point, and the mismatch check compares the two
   figures directly.
3. **`PaymentMethod` is a new enum** (`BANK_TRANSFER`, `EASYPAISA`, `JAZZCASH`,
   `CASH_DEPOSIT`, `OTHER`). There was no existing payment-method enum to reuse
   (`Payment.provider` is a free string of gateway names), so this introduces one
   in the schema's existing SCREAMING_SNAKE convention.
4. **Approval reuses the existing "mark invoice paid" logic** rather than a new
   one: the route creates a `Payment` row (`provider: 'manual_proof'`, status
   `pending`, linked by a new unique `Payment.paymentProofId`) and calls the
   existing `recordSuccessfulPayment()`, which writes the terminal `succeeded`
   status, flips the invoice to `PAID`, audits `PAYMENT_CONFIRMED` and is
   race-safe via an atomic claim. `Invoice.paymentSource` (`gateway` |
   `manual_proof`) is added and set by that same function, which is what makes
   gateway and proof payments report uniformly (Phase 7 analytics sums
   `Payment` rows with `status = 'succeeded'`, provider-agnostic).
5. **Downstream effects needed no extra code:** the dues-reminder job selects
   only `ISSUED`/`OVERDUE` invoices, so an invoice paid by an approved proof
   stops being reminded exactly like a gateway-paid one.
6. **RBAC reuses the existing matrix** with a new `payment_proof` resource:
   `create` for residents and admins, `read`/`update` for admins. There is no
   `review` action in the matrix, so approve/reject are gated as `update`,
   matching how SOS acknowledgement and transfer clearance are gated.
7. **Notifications reuse the existing system** with three events:
   `PAYMENT_PROOF_SUBMITTED` (to the society's active admins),
   `PAYMENT_PROOF_APPROVED` and `PAYMENT_PROOF_REJECTED` (to the submitting
   resident), each also written to the audit trail like every other event.
   Approach and rejection are atomic claims from `PENDING`, and a rejection
   without a reason is rejected at the Zod boundary.
8. **One pending proof per invoice** (409 on a second submission) and no
   stacking; a rejected proof can be resubmitted immediately because it is no
   longer pending.