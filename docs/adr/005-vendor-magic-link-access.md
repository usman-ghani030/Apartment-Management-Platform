# ADR 005: Vendor Access to Assigned Tickets (Magic Link)

**Status**: Accepted
**Date**: 2026-09-13

## Context

`Ticket.assignedTo` is a free-text vendor name — vendors have no `User` record, no `Membership`, and no login (PLAN.md §13). That left a real gap in the Maintenance Ticketing flow: once an admin assigned a ticket, the vendor had no way to learn about it and no way to update its status, so every status change had to be relayed manually by an admin.

Options considered:

1. **Give vendors accounts** (`Role.VENDOR` already exists in the enum) — rejected. It means invitations, password/Google auth, membership lifecycle, and permission matrix work for a group of users who interact with exactly one ticket at a time. It also expands the app's attack surface for the least-trusted actor in the system.
2. **No vendor-facing surface; admins relay everything** — rejected. This is the status quo that created the gap.
3. **A secret-token "magic link" scoped to a single ticket, no account** — chosen.

## Decision

When an admin assigns (or reassigns) a ticket to a vendor with a contact email, the backend issues a token-secured public link, emails it via the `EmailProvider` (ADR 004), and the vendor opens a read/limited-update page with no login.

Concretely:

- **Token**: 256 bits from `crypto.randomBytes(32)`, base64url-encoded. Only its **SHA-256 hash** is stored (`Ticket.vendorAccessTokenHash`, unique) — the raw token exists only inside the emailed URL, so a database leak cannot be replayed.
- **Validity is governed by ticket state, not by a clock.** The token is deliberately **not single-use and not time-limited** because the vendor returns to the same link over several days ("In Progress" today, "Resolved" later). It stops working when:
  - the ticket is reassigned — the stored hash is **rotated**, so the previous vendor's link 404s immediately;
  - the ticket is **CLOSED** by an admin — denied by an explicit status check on every request (the hash is intentionally left in place so the vendor is told *"this ticket has been closed"* instead of getting a generic invalid-link error);
  - the ticket is unassigned, or reassigned without a usable contact email — the hash is cleared.
  - **Consequence for future work:** because a closed ticket's hash survives, any future "reopen" transition **must rotate the vendor token**, or the old link would come back to life.
- **Scoping is structural.** The hash is a unique column on the `Ticket` row, so a token can only ever resolve to the one ticket it was issued for. The route additionally re-checks `deletedAt`, `assignedTo`, and status on every request, and never accepts a ticket id from the client.
- **The vendor's view is deliberately minimal**: reference, society name, title, description, category, unit number, photos, and status. No resident name/email/phone, no financial data, no comments, no other tickets, nothing admin-only.
- **The vendor's only write is a status transition**, restricted to `ASSIGNED → IN_PROGRESS → RESOLVED`. `CLOSED` is an admin action because Phase 7's vendor rating is captured at close, so RESOLVED is the end of the vendor's flow.
- **Audit attribution**: vendor actions are logged with `actorUserId: null` and `action: 'TICKET_STATUS_UPDATED_BY_VENDOR'`, with `after.vendor` naming the vendor — distinguishable in the audit trail from admin or resident actions (there is no vendor `User` to attribute to).
- **Rate limiting** on both public endpoints (per IP and per token) to blunt brute-force scanning, even though the token space is already far too large to guess.

## Alternatives Considered

- **Short numeric / UUIDv1-style codes** — rejected; guessable or enumerable, and the link is the only credential.
- **A time-limited token with re-issue** — rejected as needless friction for a multi-day job; ticket-state invalidation covers the real risk (reassignment, closure) more precisely than a timer.
- **Storing the raw token so it can be re-shown to an admin** — rejected; hash-at-rest matches the password-reset approach and removes a replayable secret from the database.

## Consequences

- Admins must supply the vendor's email to get the "vendor notified" flow; assigning without one still works but sends no link (and revokes any previous one), and the API tells the admin this explicitly rather than pretending the vendor was notified.
- If an assignment email fails, the API returns `502 EMAIL_SEND_FAILED` even though the assignment itself was saved — deliberate, so a dead SMTP path is never mistaken for a notified vendor.
- Vendor status updates are changes made by a party outside the app, so the CLOSED gate lives in one place (`routes/vendor-portal.ts`) and is re-checked on both the read and the write path.
- The link is a bearer credential: anyone the vendor forwards it to can update the ticket. This is stated plainly in the email and on the page. Accepted for the current threat model (an internal maintenance workflow), and revocable at any time by reassigning or closing.
- A dedicated vendor portal with accounts remains a possible future direction; this ADR does not commit to it, and nothing here prevents it (the token is orthogonal to a future `Vendor` entity).
