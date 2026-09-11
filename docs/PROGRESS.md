# Project Progress Log

## Phase 0 — Foundation ✅

- [x] npm workspaces scaffold (frontend, backend, shared) — done 2026-07-19
- [x] Prisma schema: `Society`, `Building`, `Unit`, `User`, `Membership`, `AuditLog` — done 2026-07-19
- [x] Postgres + Redis running in Docker — done 2026-07-20
- [x] All backend infrastructure (tenant scoping, auth, RBAC, audit, error handling, seed) — done 2026-07-20
- [x] Frontend auth pages (login, signup, admin/resident dashboards) — done 2026-07-20
- [x] Docker backend service (Express runs in Docker) — done 2026-07-20

## Phase 1 — Core MVP ✅

- [x] Notice CRUD with publish/draft workflow + read receipts — done 2026-07-20
- [x] Resident directory with building-grouped view & search — done 2026-07-20
- [x] Maintenance ticketing with status lifecycle (OPEN → CLOSED) + comments — done 2026-07-20
- [x] Notification stubs (console + audit trail) wired into notices & tickets — done 2026-07-20

## Phase 2 — Money ✅

- [x] Invoice/Payment Prisma schema — done 2026-07-20
- [x] Invoice CRUD (admin create, list/update, status management) — done 2026-07-20
- [x] Resident invoice view & dispute flow — done 2026-07-20
- [x] Stripe integration (pay endpoint, offline fallback mode) — done 2026-07-20
- [x] Payment history endpoint — done 2026-07-20
- [x] Units listing endpoint for invoice creation dropdown — done 2026-07-20
- [x] Admin invoice management page — done 2026-07-20
- [x] Resident invoices/payments page — done 2026-07-20

## Phase 3 — Bookings ✅

- [x] Amenity/Booking Prisma schema (Amenity, Booking models with enums) — done 2026-07-20
- [x] Amenity CRUD (admin create/edit, toggle active) — done 2026-07-20
- [x] Booking system with conflict detection & booking rules (duration, advance notice, daily limit) — done 2026-07-20
- [x] Booking cancel with ownership + admin override — done 2026-07-20
- [x] Admin amenities management page with booking overview — done 2026-07-20
- [x] Resident amenity booking page with time slot booking & cancel — done 2026-07-20
- [x] Dashboard navigation links updated — done 2026-07-20

## Phase 4 — Security & Visitor Management ✅

- [x] Prisma schema: VisitorPass, GateLog models + enums — done 2026-07-20
- [x] Visitor pass CRUD (resident create, update, cancel) — done 2026-07-20
- [x] QR code generation (auto token) — done 2026-07-20
- [x] QR verification endpoint for security guard — done 2026-07-20
- [x] Gate check-in/check-out with status tracking — done 2026-07-20
- [x] Auto-approve passes on scan — done 2026-07-20
- [x] Auto-revoke visitor passes on membership revocation — done 2026-07-20
- [x] Resident visitor pass management page with QR code display — done 2026-07-20
- [x] Guard interface page (tablet-friendly, QR verification, check-in/out) — done 2026-07-20
- [x] Dashboard navigation links updated — done 2026-07-20

## Phase 5 — Governance ✅

- [x] Prisma schema: Poll, Vote models + enums (PollStatus, ResultsVisibility) — done 2026-07-20
- [x] Shared types (PollStatus, ResultsVisibility, PollOption, Zod schemas) — done 2026-07-20
- [x] Permissions (poll resource for admin CRUD) — done 2026-07-20
- [x] Poll CRUD (admin create, update, activate, close) — done 2026-07-20
- [x] Vote casting with one-vote-per-unit enforcement (unique on pollId+unitId) — done 2026-07-20
- [x] Results visibility rules (LIVE / AFTER_CLOSE / NEVER) — done 2026-07-20
- [x] Dedicated results endpoint with visibility check — done 2026-07-20
- [x] Admin poll management page (create, activate, close, results bars) — done 2026-07-20
- [x] Resident voting page (active polls, radio-style voting, results display) — done 2026-07-20
- [x] Dashboard navigation links updated — done 2026-07-20

## Phase 6 — Documents & Enhanced Audit ✅

- [x] Prisma schema: DocumentFolder (self-referencing parent hierarchy), Document — done 2026-07-20
- [x] Multer file upload (local storage, 50MB limit) — done 2026-07-20
- [x] Document CRUD (admin upload, folder management, download, soft-delete) — done 2026-07-20
- [x] Audit log viewer with search, action/entity filters, pagination — done 2026-07-20
- [x] Entity-specific audit log endpoint — done 2026-07-20
- [x] JSON export endpoint for committee transition — done 2026-07-20
- [x] Admin document management page with folder tree — done 2026-07-20
- [x] Audit trail UI page with export button — done 2026-07-20
- [x] Resident document viewer page — done 2026-07-20
- [x] Dashboard navigation links updated — done 2026-07-20

## Phase 7 — Engagement & Accountability (In Progress)

### Slice: Safepay Online Dues Payments (hosted checkout) ✅

- [x] `PaymentProvider` interface + `SafepayPaymentProvider` behind it (ADR 003) — no route code calls Safepay directly
- [x] Hosted checkout flow: passport token → tracker creation (`POST /order/payments/v3/`) → redirect to `/embedded/` checkout URL
- [x] `POST /api/v1/invoices/:id/pay` now creates a Safepay session (offline fallback kept when keys absent)
- [x] `POST /api/v1/payments/webhook` — HMAC-SHA512 signature verified over raw body (`X-SFPY-SIGNATURE`), idempotent via tracker token, updates invoice + audit + PAYMENT_CONFIRMED notification
- [x] `POST /api/v1/payments/:tracker/verify` + `POST /api/v1/invoices/:id/verify-payment` — server-side reconciliation fallback
- [x] Payment schema: `provider`, `providerSessionId` (unique), `providerTxnRef` + migration `20260729000000_add_payment_provider_fields`
- [x] Resident invoices page: success/cancelled banners after redirect + verify fallback + manual "Check payment status"
- [x] Admin invoices page: payment history table with Safepay method + transaction reference (reconciliation view)
- [x] `.env.example` updated: SAFEPAY_PUBLIC_KEY, SAFEPAY_PRIVATE_KEY, SAFEPAY_ENV, SAFEPAY_WEBHOOK_SECRET
- [x] Full test suite: 69/69 passing (9 new: signature verify + webhook route + pay endpoint)

**Notes:**
- Webhook URL to register in Safepay dashboard: `https://<railway-host>/api/v1/payments/webhook`
- `SAFEPAY_WEBHOOK_SECRET` must be added to Railway env (see manual test guide)
- `verifyPayment` POSTs to the tracker action endpoint; webhook remains the source of truth

---

### Slice 1: Package/Parcel Tracking ✅

- [x] Prisma schema: ParcelStatus enum + Parcel model with proper relation names, indexes, soft-delete
- [x] Shared types (ParcelStatusValues, CreateParcelSchema, UpdateParcelSchema, ParcelResponse)
- [x] Permissions updated (parcel resource: guards/admins create, residents view/collect)
- [x] PARCEL_ARRIVED notification event added
- [x] API routes: full CRUD at /api/v1/parcels (tenant-scoped, Zod validated, audit logged)
- [x] Migration SQL created (20260728000002_add_parcel_tracking)
- [x] Admin parcels management page (log arrival, mark collected, filter/search)
- [x] Resident parcels view page (awaiting collection, mark collected, history)
- [x] Admin sidebar: Packages link added
- [x] Resident dashboard: Package quick action added
- [x] Full test suite: 60/60 passing

**Notes (later session):**
- Parcel photo upload added: `POST /api/v1/parcels/photo` (multer, JPEG/PNG/WebP/GIF, 10MB) + `GET /api/v1/parcels/photo/:filename` — admin & resident pages show thumbnails, admin form uses a real file picker
- Guard dashboard (`/dashboard/guard`) has a Parcels tab: unit dropdown, description, optional photo upload, full-width "Log Arrival"
- Migration needs to be applied on Railway via `prisma migrate deploy`

---

### Slice 2: Automated Dues Reminders ✅

- [x] Prisma schema: `Society.dueReminderDays Int @default(3)` + `InvoiceReminder` table (unique on invoiceId+dueDate so each due date is reminded exactly once)
- [x] Migration `20260817000000_add_due_reminders` (additive only)
- [x] `DUE_REMINDER` notification event (audit trail + console, same pattern as other events)
- [x] BullMQ installed; `backend/src/queue/` — daily repeatable job (09:00 UTC, `DUE_REMINDER_CRON` override) + resilient worker (safe "disabled" mode when Redis is down; API unaffected)
- [x] `backend/src/lib/due-reminders.ts` — pure selection logic: unpaid (ISSUED/OVERDUE) invoices due within each society's window, one reminder per (invoice, dueDate), per-invoice error isolation, optional societyId for tenant-scoped runs
- [x] Settings API: `GET /api/v1/settings`, `PATCH /api/v1/settings` (admin-only, Zod 1–30 days, audit logged), `POST /api/v1/settings/run-reminders` (admin-only manual trigger, tenant-scoped, audit logged)
- [x] Queue wired into `index.ts` with graceful shutdown; started after `app.listen`
- [x] Admin invoices page: "Automated dues reminders" card (days-before input + Save + "Send reminders now")
- [x] Resident invoices page: "Due in X days" / "Overdue by X days" badges on unpaid invoices
- [x] Tests: 80/80 passing (9 new — reminder selection logic + settings route auth gates)
- [x] Live-verified: GET/PATCH settings, manual trigger sent 1 reminder, second run idempotent (0), audit entries written, queue scheduler registered on boot

**Notes:**
- On Railway, add a Redis service and set `REDIS_URL` for the scheduled job to fire; without it the queue stays disabled but manual trigger still works
- `DUE_REMINDER_CRON` env var (cron format, default `0 9 * * *`) optional

---

### Slice 3: Vendor Ratings ✅

- [x] Prisma schema: `Ticket.rating Int?` (1–5), `ratingComment`, `ratedById`, `ratedAt` + `User.ticketsRated` relation + index `(assignedTo, rating)`; migration `20260817000001_add_vendor_ratings` (additive only)
- [x] Shared: `UpdateTicketSchema` gains `rating` + `ratingComment`; `TicketResponse` gains rating/ratedBy fields; new `VendorRatingSummary` type
- [x] Permissions: new `vendor` resource (`read`: SUPER_ADMIN, COMMITTEE_ADMIN)
- [x] `PATCH /tickets/:id` — rating only allowed when the ticket is (or is becoming) CLOSED; re-rating a closed ticket allowed; saves `ratedById` + `ratedAt`; audit log includes rating snapshot
- [x] `GET /api/v1/tickets/vendor-ratings` — admin-only aggregation (groupBy assignedTo, avg rounded to 1dp, sorted by avg then count); placed before `GET /:id`
- [x] Admin tickets page: "Close & rate" flow (5-star picker + optional comment + confirm), vendor ratings summary panel, inline average rating while typing an assignee name, star chip on rated cards, existing-rating display on closed tickets
- [x] Tests: 91/91 passing (11 new — rating rules, aggregation endpoint shape, admin gate, permission matrix)
- [x] Live-verified: create → assign → rate-while-open rejected (400) → close with 4★ + comment (ratedByName returned) → aggregation shows `ABC Plumbing 4.0 (1)` → cleaned up

**Notes:**
- Ratings aggregate by the free-text `assignedTo` vendor name (there is no vendor entity); identical names aggregate together
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 4: Admin Analytics Dashboard ✅

- [x] Prisma: `Ticket.closedAt` (set once on the transition into CLOSED — unlike `updatedAt`, it doesn't move on re-rating); migration `20260817000002_add_ticket_closed_at` (additive only)
- [x] Permissions: new `analytics` resource (`read`: SUPER_ADMIN, COMMITTEE_ADMIN)
- [x] `GET /api/v1/analytics` (admin-only, tenant-scoped, read-only aggregates):
  - `duesCollection` — last 6 monthly buckets: invoiced (sum of invoice amounts due that month, excl. CANCELLED) vs collected (succeeded Payment rows by paidAt) + collection rate %
  - `ticketResolution` — avg hours/days from createdAt → closedAt (falls back to updatedAt) across closed tickets
  - `ticketVolumeByCategory` — groupBy category, sorted desc
  - `vendorPerformance` — per vendor: avg rating, rating count, closed-ticket volume (merged from two groupBys)
- [x] Frontend `/dashboard/admin/analytics` — 4 summary tiles, CSS-only collection-rate bar chart (no chart lib added), category progress bars, vendor performance list with stars; sidebar link under Finance & Records (PieChart icon)
- [x] Tests: 99/99 passing (8 new — analytics aggregation shape, empty-data handling, admin gate, permission matrix)
- [x] Live-verified: endpoint returns real seed data (July collected Rs 50, Aug invoiced Rs 100), resident gets 403, closing a ticket sets closedAt + populates resolution/category/vendor sections → cleaned up

**Notes:**
- All analytics are read/aggregate queries over existing data — no new core entities
- Migration needs `prisma migrate deploy` on Railway

---

## Architectural Decisions Logged
- **ADR-001**: Custom roll-your-own auth (bcrypt + JWT in HTTP-only cookies).
- **ADR-002**: Cloudinary for file storage (optimized image transform and upload).

---

## Phase 7 — Unit Enhancement + Resident Detail (Bedroom Type + Primary Contact + Drill-Down) ✅

### Slice: Bedroom Type, Primary Contact & Building/Unit Drill-Down

- [x] Prisma schema: `BedroomType` enum + `bedroomType`, `primaryContactName`, `primaryContactEmail`, `primaryContactPhone` fields on Unit — done 2026-08-31
- [x] Migration `20260831000000_add_unit_bedroom_type_and_primary_contact` (additive only, all nullable) — done 2026-08-31
- [x] Shared types: `BedroomType` enum, `BedroomTypeValues`, `BEDROOM_TYPE_LABELS` — done 2026-08-31
- [x] Backend: Unit CRUD routes updated with new fields (create, update, list, detail) — done 2026-08-31
- [x] Backend: `GET /api/v1/units/:id` — full unit detail with members, recent tickets — done 2026-08-31
- [x] Backend: `GET /api/v1/buildings/:id` — building detail with all units and occupant info — done 2026-08-31
- [x] Frontend: Unit form updated with bedroom type dropdown + primary contact fields — done 2026-08-31
- [x] Frontend: Unit list shows bedroom type and occupant summary — done 2026-08-31
- [x] Frontend: Unit list items clickable → navigates to unit detail page — done 2026-08-31
- [x] Frontend: Building list items clickable → navigates to building detail page — done 2026-08-31
- [x] Frontend: Building detail page with units grouped by floor — done 2026-08-31
- [x] Frontend: Unit detail page with occupant info (linked resident vs primary contact vs vacant) — done 2026-08-31
- [x] Backend: `GET /api/v1/directory/:userId` — full resident detail with unit, tickets, invoices — done 2026-08-31
- [x] Frontend: Resident detail page with profile, unit info, recent tickets, recent invoices — done 2026-08-31
- [x] Frontend: Directory list items clickable → navigates to resident detail page — done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Migration needs `prisma migrate deploy` on Railway
- Primary Contact fields are labeled as "not yet linked to an account" in UI when no active membership exists
- Unit detail shows linked residents when available, falls back to primary contact fields, else shows "Vacant"
- Unit detail page includes an "Invite as Resident" button when a primary contact email exists but no linked resident
- Resident detail page shows ticket stats (total, open) and recent invoices with amounts
- Building and unit names are clickable links to their respective detail pages

---

## Phase 8 — Safety, Staff & Automated Billing (In Progress)

### Slice 1: Staff Management ✅

- [x] Prisma schema: `StaffRole` enum + `Staff` model (societyId, name, role, email, phone, isActive, soft-delete, indexes) — done 2026-08-31
- [x] Migration `20260831010000_add_staff_management` (additive only) — done 2026-08-31
- [x] Shared types: `StaffRole` enum, `StaffRoleValues`, `STAFF_ROLE_LABELS`, `CreateStaffSchema`, `UpdateStaffSchema`, `StaffResponse` — done 2026-08-31
- [x] Permissions: `staff` resource (CRUD for admins, read for residents) — done 2026-08-31
- [x] Backend: Full CRUD at `/api/v1/staff` + `/api/v1/staff/on-duty` (tenant-scoped, Zod validated, audit logged) — done 2026-08-31
- [x] Frontend: Admin staff management page at `/dashboard/admin/staff` (add, edit, deactivate, delete, search, filter) — done 2026-08-31
- [x] Frontend: Admin sidebar: Staff link added under Operations — done 2026-08-31
- [x] Frontend: Resident dashboard: "Staff on Duty" card showing active staff — done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Staff on-duty endpoint (`GET /api/v1/staff/on-duty`) is accessible to all authenticated users (residents included)
- Active filter shows only `isActive: true` staff; admin page shows all with toggle
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 2: Targeted Notifications ✅

- [x] Prisma schema: `Notice.targetType` (ALL_UNITS | SPECIFIC_UNITS) + `Notice.targetUnitIds` (JSON array of unit IDs) — done 2026-08-31
- [x] Migration `20260831020000_add_notice_targeting` (additive only, defaults to ALL_UNITS) — done 2026-08-31
- [x] Shared types: `CreateNoticeSchema` + `UpdateNoticeSchema` with `targetType` + `targetUnitIds` fields — done 2026-08-31
- [x] Backend: Notice create/update routes accept targeting fields — done 2026-08-31
- [x] Backend: Notice list endpoint filters by targeting for residents (ALL_UNITS or their specific unit) — done 2026-08-31
- [x] Backend: Notice detail endpoint checks targeting for residents — done 2026-08-31
- [x] Frontend: Admin notice form with "Target Audience" toggle (All Units / Specific Units) + unit multi-select — done 2026-08-31
- [x] Frontend: Notice cards show target badge (All units / N units) — done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Targeting is opt-in: existing notices default to ALL_UNITS (backward compatible)
- Resident filtering uses application-level post-filter (Prisma JSON path queries don't support array_contains cleanly)
- Audit log includes targetType and targetUnitIds for notice create/update
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 3: SOS Emergency Alerts ✅

- [x] Prisma schema: `SOSAlertStatus` enum + `SOSAlertCategory` enum + `SOSAlert` model (societyId, unitId, residentId, category, status, notes, resolvedByUserId, resolvedAt, indexes) — done 2026-08-31
- [x] Migration `20260831030000_add_sos_alerts` (additive only) — done 2026-08-31
- [x] Shared types: `SOSAlertStatus`, `SOSAlertCategory`, labels, `TriggerSOSSchema`, `ResolveSOSSchema`, `SOSAlertResponse` — done 2026-08-31
- [x] Permissions: `sos_alert` resource (create for residents/admins, read/update for admins) — done 2026-08-31
- [x] Notifications: `SOS_ALERT_TRIGGERED`, `SOS_ALERT_ACKNOWLEDGED`, `SOS_ALERT_RESOLVED` events with full audit trail — done 2026-08-31
- [x] Backend: `POST /api/v1/sos-alerts` (resident trigger, validates unit, notifies admins + guard staff) — done 2026-08-31
- [x] Backend: `GET /api/v1/sos-alerts` (admin list, filterable by status) — done 2026-08-31
- [x] Backend: `GET /api/v1/sos-alerts/active-count` (dashboard badge) — done 2026-08-31
- [x] Backend: `GET /api/v1/sos-alerts/:id` (admin detail) — done 2026-08-31
- [x] Backend: `PATCH /api/v1/sos-alerts/:id` (admin acknowledge/resolve with notes) — done 2026-08-31
- [x] Frontend: Resident dashboard — prominent SOS Emergency button with category picker + confirmation + sent state — done 2026-08-31
- [x] Frontend: Admin SOS alerts page at `/dashboard/admin/sos-alerts` (list, filter, detail modal, acknowledge, resolve with notes) — done 2026-08-31
- [x] Frontend: Admin sidebar — SOS Alerts link added under Operations — done 2026-08-31
- [x] Frontend: Admin dashboard — active SOS alerts shown in "Needs your attention" panel with pulse indicator — done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- SOS button is large, high-contrast (red), accessible — easy to find under stress per AGENTS.md Section 14
- Resident trigger validates unit belongs to their society before creating alert
- Admin notifications logged to console (real push/email deferred to notification provider)
- Active count endpoint powers both dashboard badge and sidebar indicator
- Full audit trail for triggered/acknowledged/resolved actions
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 4: Transfer Clearance ✅

- [x] Backend: `GET /api/v1/units/:id/transfer-check` — checks unpaid invoices, returns outstanding list + active members + primary contact — done 2026-08-31
- [x] Backend: `POST /api/v1/units/:id/complete-transfer` — re-checks invoices (safety gate), deactivates memberships, clears primary contact, comprehensive audit log — done 2026-08-31
- [x] Frontend: Unit detail page — "Transfer / Move-Out" button (red, only shown when unit has occupants) — done 2026-08-31
- [x] Frontend: Transfer clearance modal — shows unpaid invoices (blocked), active members to deactivate, primary contact to clear — done 2026-08-31
- [x] Frontend: Complete button only enabled when all dues settled, cancel button always available — done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Transfer has double safety gate: frontend checks canTransfer, backend re-checks before executing
- Audit log captures full before/after state (members, contacts, unit info)
- Route order: transfer-check and complete-transfer registered BEFORE `/:id` GET to avoid route conflicts
- Seed script has FK order issue (not related to this feature) — needs investigation
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 5: Automated Recurring Billing ✅

- [x] Prisma schema: `Society.billingDayOfMonth` (nullable Int, 1-28) + `Invoice.billingPeriod` (nullable String) + unique constraint on (societyId, unitId, billingPeriod) for idempotency — done 2026-08-31
- [x] Migration `20260831040000_add_recurring_billing` (additive only) — done 2026-08-31
- [x] Shared types: `UpdateBillingSettingsSchema` with `billingDayOfMonth` field — done 2026-08-31
- [x] `backend/src/lib/recurring-billing.ts` — pure billing logic: generates invoices for all active units, idempotent via billingPeriod unique constraint + P2002 race condition handling — done 2026-08-31
- [x] `RECURRING_BILLING_GENERATED` notification event with full audit trail — done 2026-08-31
- [x] BullMQ job: monthly repeatable (1st of month 08:00 UTC, `RECURRING_BILLING_CRON` override), starts on boot alongside due-reminder job — done 2026-08-31
- [x] Settings API: `PATCH /api/v1/settings` now accepts `billingDayOfMonth`, `POST /api/v1/settings/run-billing` manual trigger — done 2026-08-31
- [x] Frontend: Admin invoices page — "Recurring billing" card with day-of-month dropdown + Save + "Generate now" button — done 2026-08-31
- [x] Idempotency verified: first run creates 5 invoices, second run skips all 5 — done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Billing day limited to 1-28 to avoid month-end issues
- Invoice amount defaults to 0 — admin sets amounts per invoice after generation
- Due date set to billingDay + 7 days
- Invoice number format: BILL-YYYYMM-NNN (sequential per period)
- This job CREATES invoices; Phase 7's dues-reminder job REMINDS about existing invoices — both coexist
- Seed script fixed: FK delete order corrected, now runs cleanly
- Migration needs `prisma migrate deploy` on Railway

---

## Phase 8 — Complete ✅

All 5 slices implemented and tested:
1. Staff Management ✅
2. Targeted Notifications ✅
3. SOS Emergency Alerts ✅
4. Transfer Clearance ✅
5. Automated Recurring Billing ✅

---

## Bulk CSV Import (Buildings + Units) ✅

### Slice: CSV Import for Units & Buildings

- [x] Installed `papaparse` + `@types/papaparse` in backend — done 2026-09-10
- [x] Shared types: `CSVUnitRowSchema` (reuses same validation as manual unit form), `CSV_IMPORT_MAX_ROWS`, `CSV_IMPORT_MAX_FILE_SIZE_BYTES`, `CSV_IMPORT_HEADERS`, `CSVValidateResult`, `CSVImportJobResult` — done 2026-09-10
- [x] Backend: `POST /api/v1/import/validate` — parses CSV (papaparse with header: true), validates every row with shared Zod schema, checks duplicates against existing units, returns `{toCreate, toSkip, errors, totalRows}` — NO DB writes — done 2026-09-10
- [x] Backend: `POST /api/v1/import/confirm` — accepts validated rows, re-validates server-side, creates buildings if new + units, returns `{jobId, status, created, skipped, errors}` — done 2026-09-10
- [x] Backend: `GET /api/v1/import/status/:jobId` — poll job progress (in-memory job store with 30min TTL) — done 2026-09-10
- [x] Backend: `GET /api/v1/import/sample-csv` — downloadable template CSV generated from same headers as validation schema — done 2026-09-10
- [x] Frontend: "Import CSV" button on admin units page — modal with 4-step flow: Upload → Preview → Importing → Done — done 2026-09-10
- [x] Frontend: Preview shows toCreate/toSkip/errors counts, skipped/error details, preview table of first 10 rows — done 2026-09-10
- [x] Frontend: Download sample CSV button in the import modal — done 2026-09-10
- [x] Idempotency verified: second import of same rows skips all (0 created, N skipped) — done 2026-09-10
- [x] Error validation: catches missing building name, missing unit number, out-of-range floor, invalid bedroom type, invalid email — done 2026-09-10
- [x] RBAC: residents get FORBIDDEN on validate/confirm — done 2026-09-10
- [x] Audit trail: single `CSV_IMPORT_COMPLETED` entry per import (societyId, counts) — done 2026-09-10
- [x] Full test suite: 117/117 passing

**Notes:**
- CSV format: `Building Name, Unit Number, Floor, Bedroom Type, Primary Contact Name, Primary Contact Email, Primary Contact Phone`
- Empty optional CSV cells handled correctly (empty string → null, not validation error)
- Buildings auto-created if they don't exist for the society
- Duplicate detection: match on (societyId, buildingName, unitNumber)
- Max file size: 2 MB, max rows: 1000
- `papaparse` installed in backend for CSV parsing (header mode, skipEmptyLines, BOM-aware)

---

## Validation Hardening Pass ✅ (post-Phase-8, correctness only)

Goal: every route/form validates input at the boundary with clear `{ data: null, error }` responses. No business logic or data-model changes — restrictive additions only.

### Backend
- [x] Shared Zod schemas hardened (length/bounds on free text so rules can't drift between front/back):
  - Auth: signup/login email max 200; password max 128; name/societyName max 100; slug max 50; invite name max 100
  - Notices: content max 10,000; category max 100 (create + update)
  - Tickets: description max 5,000; category max 100; assignedTo max 100 (create + update); comment content max 2,000
  - Invoices: description max 1,000 (create + update)
  - Amenities: description max 1,000 (create + update)
  - Visitor passes: visitorPhone max 30, email max 200, vehicleNumber max 30, purpose max 200 (create + update)
  - Polls: title description max 2,000; option label max 100, option description max 300
  - Documents: new `UpdateDocumentSchema` (name 1–200, description max 1,000, folderId UUID)
- [x] `PATCH /api/v1/documents/:id` — was taking raw `req.body` with NO validation at all (only route found with no Zod); now parses `UpdateDocumentSchema` — done 2026-09-03
- [x] Visitor gate log `POST /visitors/:id/gate` — body now Zod-validated: `action` must be ENTRY/EXIT, `notes` optional max 500 (was a manual cast + action check, notes unvalidated)
- [x] Units (inline schemas): `floor` bounded 0–500; primaryContactName min/max 100 (no empty strings); primaryContactEmail max 200; primaryContactPhone max 30; bedroomType nullable on create (so an unselected dropdown doesn't 400)
- [x] Document uploads: server-side MIME allowlist (PDF/Office/text/CSV/images) added to the 50 MB multer limit; upload errors (e.g. file too large) now map to clean 400 `VALIDATION_ERROR` responses instead of 500s
- [x] Ticket + parcel photo-serve endpoints: filename must match the sanitized upload charset — blocks path-traversal (`../`) attempts (was `path.join` straight from user input)
- [x] Error handler duck-types ZodErrors (name + issues array) in addition to `instanceof` — robust when two zod copies are in the module graph (vitest does this; prod via tsx has one copy)

### Frontend (mirror only — server is the source of truth)
- [x] `maxLength`/bound attributes added to mirror the new server caps: notice title/content, ticket title/description + comment boxes, invoice title/description, staff name/email/phone, invite name/email, visitor name/phone/email/vehicle/purpose, unit number/floor/contact fields
- [x] Admin invoices: amount input `min="0.01"` (was `min="0"`, letting 0 through to a server 400); submit now pre-checks positive amount + due date with a clear inline error
- [x] Unit edit form: contact email/phone are now fetched from the unit detail before editing — previously they were always blank on edit and a save would silently wipe existing primary-contact data

### Tests
- [x] New hermetic `backend/src/routes/validation.test.ts` (18 tests, no real DB): rejects over-limit signup password/society name, notice content > 10k, non-UUID targetUnitIds, ticket description > 5k (create + update), comment > 2k, unit floor 501 / −1 / bad contact email, document PATCH bad folderId + empty name (valid rename accepted), gate action not ENTRY/EXIT + notes > 500 (valid ENTRY accepted), and `..%2F` photo-filename traversal (400)
- [x] Full test suite: 117/117 passing (99 pre-existing + 18 new)

**Notes:**
- Flagged, NOT fixed (out of scope for a validation pass): invoice `PATCH` allows arbitrary status transitions (e.g. PAID-adjacent flows rely on route checks only on PAID); audit-log `page` query param isn't clamped (garbage → 500). Both are business-logic/robustness, not input-validation.
- No DB migration was needed — every change is schema-level (Zod) or route-level.

---

## Google Sign-In (additional auth method) ✅

### Slice: Google Sign-In via Google Identity Services (GSI)

- [x] Prisma schema: `User.passwordHash` now nullable (Google-only accounts), `User.googleId` (unique, nullable), `User.emailVerified` (default false) — done 2026-09-11
- [x] Migration `20260911000000_add_google_auth` (additive only; `passwordHash` drop-NOT-NULL is backfill-safe; verified applied against dev DB) — done 2026-09-11
- [x] `google-auth-library` installed in backend — done 2026-09-11
- [x] `backend/src/lib/google-auth.ts` — `verifyGoogleIdToken()` verifies signature/audience/expiry via Google's official lib; wraps failures into `AppError(401 INVALID_CREDENTIALS)`; requires `GOOGLE_CLIENT_ID` — done 2026-09-11
- [x] Shared helpers in `backend/src/lib/auth.ts`: `setAuthCookies()` / `clearAuthCookies()` (used by login, signup, refresh, logout, google) and `createSocietyWithFirstAdmin()` (the single tenant-onboarding transaction reused by password signup AND Google signup) — done 2026-09-11
- [x] `POST /api/v1/auth/google` — accepts `{ idToken, mode: 'signin' | 'signup' }` (+ `societyName`/`societySlug` for signup):
  - `signin`: links Google account to an existing User by verified email (sets `googleId` + `emailVerified`, audit `GOOGLE_ACCOUNT_LINKED` per active society) and issues the app's own tokens exactly like login. **Unknown email → 401, NO user/membership is ever silently created.** Already-linked accounts log in without re-linking. Defensive 409 if the email is bound to a different Google account.
  - `signup`: same transaction as password signup — creates Society + first COMMITTEE_ADMIN User (with `googleId`, `emailVerified: true`, no password) + Membership + `SOCIETY_CREATED` audit; same 409 conflicts for existing email/slug.
- [x] Password login now guards `passwordHash === null` (Google-only accounts can't use a password) — done 2026-09-11
- [x] Frontend: `frontend/src/components/auth/google-sign-in-button.tsx` (GSI script loaded once, typed `window.google`) — done 2026-09-11
- [x] Login page: Google button above the form, same redirect logic as password login, green "accounts linked" banner when `linked: true` — done 2026-09-11
- [x] Signup page: Google button (requires society name + URL first), creates Society + first admin and redirects to `/dashboard/admin` — done 2026-09-11
- [x] `frontend/src/lib/api.ts`: `auth.googleSignIn(idToken)` / `auth.googleSignUp(idToken, societyName, societySlug)` — same token storage as login/signup — done 2026-09-11
- [x] `.env.example` updated: backend `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (comment → Google Cloud Console); new `frontend/.env.example` with `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — done 2026-09-11
- [x] Tests: 133/133 passing (12 new route tests + 4 new lib tests — new-user signup flow, existing-user linking, unknown-email rejection without creation, tampered token, already-linked, different-Google-account 409, signup conflicts, missing fields, Google-only user can't password-login) — done 2026-09-11
- [x] Live-verified: migration applied to dev DB; `POST /api/v1/auth/google` rejects a fake token with real Google verification → `401 INVALID_CREDENTIALS` — done 2026-09-11

**Notes:**
- GSI flow uses the ID-token pattern (no backend redirect/callback route): frontend renders the Google button, sends the signed ID token to `/api/v1/auth/google`, backend verifies it and issues its own JWT access/refresh tokens — Google's token is used once and never becomes the session token
- There is no invite-link/token signup flow in the app (invites create the User row directly), so invited Google users are handled by the signin path (existing email → link + login)
- **Human action needed:** the real `frontend/.env` had `GOOGLE_CLIENT_ID` but Next.js only inlines `NEXT_PUBLIC_*` vars into client components — the `NEXT_PUBLIC_GOOGLE_CLIENT_ID` key was appended to `frontend/.env` (same public client ID). On Railway/prod, add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the frontend env and ensure the Google Cloud Console OAuth client's Authorized JavaScript origins include the deployed origin
- `GOOGLE_CLIENT_SECRET` is documented but unused (ID-token verification doesn't need it) — only needed if a server-side OAuth flow is added later

---

## Password Reset ✅

### Slice: Forgot / Reset Password (both account types)

- [x] Prisma schema: `User.tokenVersion` (default 0, bumped on reset) + `PasswordResetToken` model (userId, tokenHash @unique, expiresAt, usedAt, createdAt); migration `20260912000000_add_password_reset` (additive, defaulted — verified applied against dev DB) — done 2026-09-11
- [x] `resend` installed; `backend/src/lib/email.ts` — `sendEmail()` lazy-inits the Resend client only when `RESEND_API_KEY` is set (dev logs instead of sending); delivery failures are logged server-side so routes never leak account existence — done 2026-09-11
- [x] `backend/src/lib/password-reset.ts` — 256-bit CSPRNG token (`crypto.randomBytes`), only its SHA-256 hash is stored; TTL via `PASSWORD_RESET_TOKEN_TTL_MINUTES` (default 60); reset-email + Google-only-email template builders — done 2026-09-11
- [x] `backend/src/lib/rate-limit.ts` — in-memory fixed-window limiter + `passwordResetEmailLimiter` (5 / 15 min per email) and `passwordResetIpLimiter` (20 / 15 min per IP); new `RATE_LIMITED` error code (429) — done 2026-09-11
- [x] `POST /api/v1/auth/forgot-password` `{ email }` — ALWAYS returns the same generic response whether or not the email exists (no enumeration; dummy hashing keeps timing comparable). Password accounts get a single-use reset link; **Google-only accounts (passwordHash null) get an informational "your account uses Google Sign-In" email — no reset link, no token, no password is ever created**; unknown emails create/send nothing. Expired tokens pruned on new requests — done 2026-09-11
- [x] `POST /api/v1/auth/reset-password` `{ token, password }` — validates token (exists / not expired / not used), atomic transaction (updateMany `usedAt: null` guard prevents double-spend + new bcrypt passwordHash + `tokenVersion` increment), deletes all other outstanding tokens for the user, audits `PASSWORD_RESET` per active society (never the password) — done 2026-09-11
- [x] Refresh tokens now carry a `tokenVersion` claim; `/refresh` rejects tokens that don't match the user's current version (`payload.tokenVersion ?? 0` keeps pre-change tokens working) → a reset force-logs-out every other session — done 2026-09-11
- [x] Shared: `ForgotPasswordSchema`, `ResetPasswordSchema` (password rules match SignupSchema: 8–128) — done 2026-09-11
- [x] Frontend: `/forgot-password` page (email → generic success), `/reset-password` page (reads `?token=`, new password + confirm → success → login), "Forgot password?" link on login page, `auth.forgotPassword` / `auth.resetPassword` in `api.ts` — done 2026-09-11
- [x] `.env.example` updated: `RESEND_API_KEY` (+ where to get it, sandbox note), `PASSWORD_RESET_TOKEN_TTL_MINUTES`; `EMAIL_FROM` comment now covers the Resend verified-domain requirement — done 2026-09-11
- [x] Tests: 152/152 passing (19 new — 14 route tests + 5 rate-limiter: end-to-end reset with hashed-token-at-rest check, expired token, already-used token, double-spend race, unknown/tampered token, Google-only email variant, no-leak byte-identical response, weak password, 429 rate limit, tokenVersion refresh acceptance/rejection incl. legacy tokens) — done 2026-09-11
- [x] Live-verified against dev DB: migration applied; forgot-password generic response for unknown email; reset flow changed admin's password (old dead, new works), bumped tokenVersion 0→1, consumed the token, wrote `PASSWORD_RESET` audit; restored `admin123` via a second reset and confirmed no leftover unused tokens — done 2026-09-11

**Notes:**
- Manual end-to-end (real inbox) needs a `RESEND_API_KEY`: either verify a sending domain and set `EMAIL_FROM`, or use Resend's sandbox (`EMAIL_FROM="OmniHome <onboarding@resend.dev>"`, delivers only to the account owner's inbox) — see `docs/MANUAL_TEST_GUIDE_PASSWORD_RESET.md`
- Rate limiter is in-memory (single instance today); PLAN.md §5's Redis-backed limiter is the documented end-state — same `check()` API, contained swap
- Reset does not auto-login; the user signs in with the new password (all old refresh tokens are dead by design)
- Judgment call: the spec offered an optional "allow Google-only accounts to add a password too" path; I chose the conservative option — Google-only accounts only get the Sign-in-with-Google email, no password creation

---

## Notes for Next Session
- **Phase 9 (AI Layer)** is next: Python + FastAPI service, pgvector, semantic search, AI features
- Backend runs inside Docker at `http://localhost:4000`, frontend at `http://localhost:3000`
- Seeded test creds: `admin@sunrise.com` / `admin123`, `resident@sunrise.com` / `resident123`
- Auth uses HTTP-only cookies — `credentials: 'include'` on all fetch calls
- Documents stored locally in `backend/uploads/` — Cloudinary integration still deferred
- `multer` and `@types/multer` installed in backend
- `qrcode.react` installed in frontend for QR code rendering
- Safepay webhook endpoint live at `/api/v1/payments/webhook` — register it in the Safepay dashboard and add `SAFEPAY_WEBHOOK_SECRET` to Railway env
- Payments fall back to offline mode only when Safepay keys are absent
- Fixed: Invite endpoint now returns `tempPassword` so admin can share with invited residents
- `ioredis` in package.json but not wired up (token blacklisting deferred)
- BullMQ wired for automated dues reminders (Slice 2) — needs `REDIS_URL` on Railway
