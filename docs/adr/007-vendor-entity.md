# ADR 007 - Vendor entity + manual WhatsApp hand-off

Date: 2026-09-17
Status: Accepted

## Context

Vendors existed only as free text: `Ticket.assignedTo` held a name typed by the
admin, and `Ticket.vendorEmail` held the address the ADR 005 magic link was sent
to. That was enough for one ticket at a time, but it means:

- The same vendor gets retyped on every assignment (typos included), so tickets
  for one vendor can silently split into several names - and the Phase 7 vendor
  ratings and Phase 7 analytics aggregate by that free-text name.
- There is no phone number anywhere, so an admin has no way to message the
  vendor on WhatsApp (the channel vendors actually use in practice).

This slice adds vendor autocomplete + inline creation on the assignment form,
E.164 phone normalization, and a manually-clicked `wa.me` deep link that carries
the same magic link that was emailed.

## Decision

1. **`Vendor` is a first-class tenant-scoped model** (`societyId`, `name`,
   `phone`, optional `email`/`notes`, `deletedAt`), with `Ticket.vendorId`
   linking the assignment. Indexed on `(societyId, name)`, `(societyId, phone)`
   and `(societyId, createdAt)`.

2. **`phone` is always stored in E.164** (`+92XXXXXXXXXX`). Normalization lives
   in one shared Zod transform (`PakistaniMobilePhoneSchema` in `shared/`), so
   the frontend and backend cannot disagree, and invalid/foreign/landline
   numbers are rejected at the boundary rather than guessed at. No phone is ever
   written un-normalized.

3. **`Ticket.assignedTo` is kept as a name snapshot** written from the vendor
   record on assignment. Vendor ratings and analytics group by that name and are
   therefore unchanged; legacy tickets with a free-text name still work exactly
   as before (`vendorId` stays `NULL` until they are reassigned to a vendor).

4. **No DB-unique on `(societyId, phone)`.** Soft-deleted vendors must not block
   re-adding a number later (PLAN §7), so the create route dedupes explicitly: a
   phone already on file for that society returns the existing vendor with
   `alreadyExisted: true`. Inline creation from the assignment form can never
   create a near-duplicate.

5. **The magic-link URL is returned to the admin in the assignment response**
   (`vendorTicketUrl`), because the WhatsApp message must carry the *same* link
   that went into the email - the requirement is explicit that no second link is
   generated. The raw token is still never persisted (only its SHA-256 hash),
   and the URL is returned only by the PATCH that issued it; it cannot be
   re-derived later.

6. **WhatsApp is a manual deep link only**: `https://wa.me/<digits>?text=...`,
   built client-side with the shared `buildWhatsAppLink` helper and opened in a
   new tab. No WhatsApp Cloud API, no BSP (Twilio/Gupshup/Wati), no message
   templates, no delivery webhooks, no scheduled/background sends. A future
   automated-WhatsApp need (e.g. dues reminders) is a separate ADR and does not
   reuse this path.

7. **Autocomplete search** uses Prisma `contains` + `mode: 'insensitive'` on
   name, and digit matching on phone - the same approach the staff and resident
   directory searches already use. Phone queries are matched both as typed and
   with leading zeros stripped, since storage drops the national trunk `0`
   (`0300-1234567` is stored as `+923001234567`). No trigram/tsvector index: a
   society's vendor list is small and capped at 10 results.

## Alternatives considered

- **WhatsApp Cloud API / BSP integration** - rejected for this slice: business
  verification, template approval and webhook infrastructure are a project of
  their own, and the requirement explicitly excludes them.
- **Storing the magic-link URL on the ticket** so the button works after a page
  reload - rejected: that is functionally the same as storing the raw token,
  which ADR 005 deliberately avoids. Instead the button appears with the link
  right after an assignment, and a later visit prompts a reassignment for a
  fresh link.
- **Making `assignedTo` a relation-only field** (dropping the name column) -
  rejected: it would rewrite the vendor-ratings and analytics aggregations that
  Phase 7 ships on, for no user-visible gain.
- **DB-unique `(societyId, phone)`** - rejected (see decision 4).
- **Keeping phone as free text** - rejected: the `wa.me` path segment needs
  digits, and inconsistent formats would break phone search.

## Consequences

- Existing tickets keep their free-text vendor name and have `vendorId = NULL`
  until reassigned through the new form; the vendor directory starts empty per
  society (the seed script creates two demo vendors locally).
- Vendor **edit/merge** (fixing a typo'd name, merging duplicates, correcting a
  phone) is not built in this slice - there is no vendor management screen yet.
  Flagged in `PROGRESS.md` as a follow-up, not silently left out.
- The vendor-search endpoint reuses the `vendor` permission resource
  (`read`/`create` for SUPER_ADMIN + COMMITTEE_ADMIN), i.e. exactly the roles
  that can already update a ticket. No new permission concept was invented.

---

## Implementation notes - contact flexibility (email OR phone, not both required)

Accepted after the vendor entity shipped, when it became clear that requiring a
phone number was blocking real vendors (a contractor with an email address and a
landline-only office, or one who simply does not use WhatsApp). The decision
above is unchanged in spirit - the manual `wa.me` hand-off stays manual - but
"both channels on file" is no longer the requirement.

**What changed**

- `Vendor.phone` and `Vendor.email` are each optional; **at least one** must be
  present. Enforced once, in the shared Zod schema (`VENDOR_CONTACT_ERROR` +
  `hasVendorContact()`), reused by create, inline-create and update. Not a DB
  constraint: it spans two columns and the API is the only writer.
- `UpdateVendorSchema` cannot decide the rule from a patch alone (`{ phone: null }`
  is legal for a vendor that has an email), so the route merges the patch onto
  the stored row and re-checks. The schema refinement only rejects a patch that
  clears both in one go.
- Assignment emails the vendor **only if an email exists**. Nothing is thrown,
  no job is queued and the assignment always succeeds; `ticket.vendorEmail` is
  left null rather than pointing at an address nothing was sent to.
- The magic-link token stays channel-independent, so a phone-only vendor is
  issued the same link an email would carry. The response exposes
  `vendorLinkSent` (was it emailed?) separately from `vendorTicketUrl` (does a
  link exist?), because those genuinely differ now and the UI must not claim a
  notification that never happened.
- A vendor with neither channel is unreachable by validation, but the assignment
  path still handles it: assign, issue no link, revoke any stale token.
- The WhatsApp button only renders when a phone exists (nothing to link to);
  when there is no email the assignment confirmation says so and points at the
  button, so the hand-off is not silently missed.

**Migration** `20260917000002_vendor_optional_contact`: `phone` drops `NOT NULL`,
and any `''` email/phone is collapsed to `NULL` so "no contact" has a single
representation. Pre-flight check found no vendor with neither channel, so no data
backfill or manual cleanup was needed.

**Still out of scope** (unchanged): automated WhatsApp of any kind, vendor
edit/merge UI, and any notion of notification delivery tracking.
