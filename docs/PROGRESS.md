# Project Progress Log

## Phase 0 - Foundation ✅

- [x] npm workspaces scaffold (frontend, backend, shared) - done 2026-07-19
- [x] Prisma schema: `Society`, `Building`, `Unit`, `User`, `Membership`, `AuditLog` - done 2026-07-19
- [x] Postgres + Redis running in Docker - done 2026-07-20
- [x] All backend infrastructure (tenant scoping, auth, RBAC, audit, error handling, seed) - done 2026-07-20
- [x] Frontend auth pages (login, signup, admin/resident dashboards) - done 2026-07-20
- [x] Docker backend service (Express runs in Docker) - done 2026-07-20

## Phase 1 - Core MVP ✅

- [x] Notice CRUD with publish/draft workflow + read receipts - done 2026-07-20
- [x] Resident directory with building-grouped view & search - done 2026-07-20
- [x] Maintenance ticketing with status lifecycle (OPEN → CLOSED) + comments - done 2026-07-20
- [x] Notification stubs (console + audit trail) wired into notices & tickets - done 2026-07-20

## Phase 2 - Money ✅

- [x] Invoice/Payment Prisma schema - done 2026-07-20
- [x] Invoice CRUD (admin create, list/update, status management) - done 2026-07-20
- [x] Resident invoice view & dispute flow - done 2026-07-20
- [x] Stripe integration (pay endpoint, offline fallback mode) - done 2026-07-20
- [x] Payment history endpoint - done 2026-07-20
- [x] Units listing endpoint for invoice creation dropdown - done 2026-07-20
- [x] Admin invoice management page - done 2026-07-20
- [x] Resident invoices/payments page - done 2026-07-20

## Phase 3 - Bookings ✅

- [x] Amenity/Booking Prisma schema (Amenity, Booking models with enums) - done 2026-07-20
- [x] Amenity CRUD (admin create/edit, toggle active) - done 2026-07-20
- [x] Booking system with conflict detection & booking rules (duration, advance notice, daily limit) - done 2026-07-20
- [x] Booking cancel with ownership + admin override - done 2026-07-20
- [x] Admin amenities management page with booking overview - done 2026-07-20
- [x] Resident amenity booking page with time slot booking & cancel - done 2026-07-20
- [x] Dashboard navigation links updated - done 2026-07-20

## Phase 4 - Security & Visitor Management ✅

- [x] Prisma schema: VisitorPass, GateLog models + enums - done 2026-07-20
- [x] Visitor pass CRUD (resident create, update, cancel) - done 2026-07-20
- [x] QR code generation (auto token) - done 2026-07-20
- [x] QR verification endpoint for security guard - done 2026-07-20
- [x] Gate check-in/check-out with status tracking - done 2026-07-20
- [x] Auto-approve passes on scan - done 2026-07-20
- [x] Auto-revoke visitor passes on membership revocation - done 2026-07-20
- [x] Resident visitor pass management page with QR code display - done 2026-07-20
- [x] Guard interface page (tablet-friendly, QR verification, check-in/out) - done 2026-07-20
- [x] Dashboard navigation links updated - done 2026-07-20

## Phase 5 - Governance ✅

- [x] Prisma schema: Poll, Vote models + enums (PollStatus, ResultsVisibility) - done 2026-07-20
- [x] Shared types (PollStatus, ResultsVisibility, PollOption, Zod schemas) - done 2026-07-20
- [x] Permissions (poll resource for admin CRUD) - done 2026-07-20
- [x] Poll CRUD (admin create, update, activate, close) - done 2026-07-20
- [x] Vote casting with one-vote-per-unit enforcement (unique on pollId+unitId) - done 2026-07-20
- [x] Results visibility rules (LIVE / AFTER_CLOSE / NEVER) - done 2026-07-20
- [x] Dedicated results endpoint with visibility check - done 2026-07-20
- [x] Admin poll management page (create, activate, close, results bars) - done 2026-07-20
- [x] Resident voting page (active polls, radio-style voting, results display) - done 2026-07-20
- [x] Dashboard navigation links updated - done 2026-07-20

## Phase 6 - Documents & Enhanced Audit ✅

- [x] Prisma schema: DocumentFolder (self-referencing parent hierarchy), Document - done 2026-07-20
- [x] Multer file upload (local storage, 50MB limit) - done 2026-07-20
- [x] Document CRUD (admin upload, folder management, download, soft-delete) - done 2026-07-20
- [x] Audit log viewer with search, action/entity filters, pagination - done 2026-07-20
- [x] Entity-specific audit log endpoint - done 2026-07-20
- [x] JSON export endpoint for committee transition - done 2026-07-20
- [x] Admin document management page with folder tree - done 2026-07-20
- [x] Audit trail UI page with export button - done 2026-07-20
- [x] Resident document viewer page - done 2026-07-20
- [x] Dashboard navigation links updated - done 2026-07-20

## Phase 7 - Engagement & Accountability (In Progress)

### Slice: Safepay Online Dues Payments (hosted checkout) ✅

- [x] `PaymentProvider` interface + `SafepayPaymentProvider` behind it (ADR 003) - no route code calls Safepay directly
- [x] Hosted checkout flow: passport token → tracker creation (`POST /order/payments/v3/`) → redirect to `/embedded/` checkout URL
- [x] `POST /api/v1/invoices/:id/pay` now creates a Safepay session (offline fallback kept when keys absent)
- [x] `POST /api/v1/payments/webhook` - HMAC-SHA512 signature verified over raw body (`X-SFPY-SIGNATURE`), idempotent via tracker token, updates invoice + audit + PAYMENT_CONFIRMED notification
- [x] `POST /api/v1/payments/:tracker/verify` + `POST /api/v1/invoices/:id/verify-payment` - server-side reconciliation fallback
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
- Parcel photo upload added: `POST /api/v1/parcels/photo` (multer, JPEG/PNG/WebP/GIF, 10MB) + `GET /api/v1/parcels/photo/:filename` - admin & resident pages show thumbnails, admin form uses a real file picker
- Guard dashboard (`/dashboard/guard`) has a Parcels tab: unit dropdown, description, optional photo upload, full-width "Log Arrival"
- Migration needs to be applied on Railway via `prisma migrate deploy`

---

### Slice 2: Automated Dues Reminders ✅

- [x] Prisma schema: `Society.dueReminderDays Int @default(3)` + `InvoiceReminder` table (unique on invoiceId+dueDate so each due date is reminded exactly once)
- [x] Migration `20260817000000_add_due_reminders` (additive only)
- [x] `DUE_REMINDER` notification event (audit trail + console, same pattern as other events)
- [x] BullMQ installed; `backend/src/queue/` - daily repeatable job (09:00 UTC, `DUE_REMINDER_CRON` override) + resilient worker (safe "disabled" mode when Redis is down; API unaffected)
- [x] `backend/src/lib/due-reminders.ts` - pure selection logic: unpaid (ISSUED/OVERDUE) invoices due within each society's window, one reminder per (invoice, dueDate), per-invoice error isolation, optional societyId for tenant-scoped runs
- [x] Settings API: `GET /api/v1/settings`, `PATCH /api/v1/settings` (admin-only, Zod 1–30 days, audit logged), `POST /api/v1/settings/run-reminders` (admin-only manual trigger, tenant-scoped, audit logged)
- [x] Queue wired into `index.ts` with graceful shutdown; started after `app.listen`
- [x] Admin invoices page: "Automated dues reminders" card (days-before input + Save + "Send reminders now")
- [x] Resident invoices page: "Due in X days" / "Overdue by X days" badges on unpaid invoices
- [x] Tests: 80/80 passing (9 new - reminder selection logic + settings route auth gates)
- [x] Live-verified: GET/PATCH settings, manual trigger sent 1 reminder, second run idempotent (0), audit entries written, queue scheduler registered on boot

**Notes:**
- On Railway, add a Redis service and set `REDIS_URL` for the scheduled job to fire; without it the queue stays disabled but manual trigger still works
- `DUE_REMINDER_CRON` env var (cron format, default `0 9 * * *`) optional

---

### Slice 3: Vendor Ratings ✅

- [x] Prisma schema: `Ticket.rating Int?` (1–5), `ratingComment`, `ratedById`, `ratedAt` + `User.ticketsRated` relation + index `(assignedTo, rating)`; migration `20260817000001_add_vendor_ratings` (additive only)
- [x] Shared: `UpdateTicketSchema` gains `rating` + `ratingComment`; `TicketResponse` gains rating/ratedBy fields; new `VendorRatingSummary` type
- [x] Permissions: new `vendor` resource (`read`: SUPER_ADMIN, COMMITTEE_ADMIN)
- [x] `PATCH /tickets/:id` - rating only allowed when the ticket is (or is becoming) CLOSED; re-rating a closed ticket allowed; saves `ratedById` + `ratedAt`; audit log includes rating snapshot
- [x] `GET /api/v1/tickets/vendor-ratings` - admin-only aggregation (groupBy assignedTo, avg rounded to 1dp, sorted by avg then count); placed before `GET /:id`
- [x] Admin tickets page: "Close & rate" flow (5-star picker + optional comment + confirm), vendor ratings summary panel, inline average rating while typing an assignee name, star chip on rated cards, existing-rating display on closed tickets
- [x] Tests: 91/91 passing (11 new - rating rules, aggregation endpoint shape, admin gate, permission matrix)
- [x] Live-verified: create → assign → rate-while-open rejected (400) → close with 4★ + comment (ratedByName returned) → aggregation shows `ABC Plumbing 4.0 (1)` → cleaned up

**Notes:**
- Ratings aggregate by the free-text `assignedTo` vendor name (there is no vendor entity); identical names aggregate together
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 4: Admin Analytics Dashboard ✅

- [x] Prisma: `Ticket.closedAt` (set once on the transition into CLOSED - unlike `updatedAt`, it doesn't move on re-rating); migration `20260817000002_add_ticket_closed_at` (additive only)
- [x] Permissions: new `analytics` resource (`read`: SUPER_ADMIN, COMMITTEE_ADMIN)
- [x] `GET /api/v1/analytics` (admin-only, tenant-scoped, read-only aggregates):
  - `duesCollection` - last 6 monthly buckets: invoiced (sum of invoice amounts due that month, excl. CANCELLED) vs collected (succeeded Payment rows by paidAt) + collection rate %
  - `ticketResolution` - avg hours/days from createdAt → closedAt (falls back to updatedAt) across closed tickets
  - `ticketVolumeByCategory` - groupBy category, sorted desc
  - `vendorPerformance` - per vendor: avg rating, rating count, closed-ticket volume (merged from two groupBys)
- [x] Frontend `/dashboard/admin/analytics` - 4 summary tiles, CSS-only collection-rate bar chart (no chart lib added), category progress bars, vendor performance list with stars; sidebar link under Finance & Records (PieChart icon)
- [x] Tests: 99/99 passing (8 new - analytics aggregation shape, empty-data handling, admin gate, permission matrix)
- [x] Live-verified: endpoint returns real seed data (July collected Rs 50, Aug invoiced Rs 100), resident gets 403, closing a ticket sets closedAt + populates resolution/category/vendor sections → cleaned up

**Notes:**
- All analytics are read/aggregate queries over existing data - no new core entities
- Migration needs `prisma migrate deploy` on Railway

---

## Architectural Decisions Logged
- **ADR-001**: Custom roll-your-own auth (bcrypt + JWT in HTTP-only cookies).
- **ADR-002**: Cloudinary for file storage (optimized image transform and upload).
- **ADR-004**: Nodemailer over Gmail SMTP behind an `EmailProvider` interface (2026-09-12).
- **ADR-005**: Vendor access to assigned tickets via a hashed, no-expiry magic link - no vendor accounts (2026-09-13).

---

## Phase 7 - Unit Enhancement + Resident Detail (Bedroom Type + Primary Contact + Drill-Down) ✅

### Slice: Bedroom Type, Primary Contact & Building/Unit Drill-Down

- [x] Prisma schema: `BedroomType` enum + `bedroomType`, `primaryContactName`, `primaryContactEmail`, `primaryContactPhone` fields on Unit - done 2026-08-31
- [x] Migration `20260831000000_add_unit_bedroom_type_and_primary_contact` (additive only, all nullable) - done 2026-08-31
- [x] Shared types: `BedroomType` enum, `BedroomTypeValues`, `BEDROOM_TYPE_LABELS` - done 2026-08-31
- [x] Backend: Unit CRUD routes updated with new fields (create, update, list, detail) - done 2026-08-31
- [x] Backend: `GET /api/v1/units/:id` - full unit detail with members, recent tickets - done 2026-08-31
- [x] Backend: `GET /api/v1/buildings/:id` - building detail with all units and occupant info - done 2026-08-31
- [x] Frontend: Unit form updated with bedroom type dropdown + primary contact fields - done 2026-08-31
- [x] Frontend: Unit list shows bedroom type and occupant summary - done 2026-08-31
- [x] Frontend: Unit list items clickable → navigates to unit detail page - done 2026-08-31
- [x] Frontend: Building list items clickable → navigates to building detail page - done 2026-08-31
- [x] Frontend: Building detail page with units grouped by floor - done 2026-08-31
- [x] Frontend: Unit detail page with occupant info (linked resident vs primary contact vs vacant) - done 2026-08-31
- [x] Backend: `GET /api/v1/directory/:userId` - full resident detail with unit, tickets, invoices - done 2026-08-31
- [x] Frontend: Resident detail page with profile, unit info, recent tickets, recent invoices - done 2026-08-31
- [x] Frontend: Directory list items clickable → navigates to resident detail page - done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Migration needs `prisma migrate deploy` on Railway
- Primary Contact fields are labeled as "not yet linked to an account" in UI when no active membership exists
- Unit detail shows linked residents when available, falls back to primary contact fields, else shows "Vacant"
- Unit detail page includes an "Invite as Resident" button when a primary contact email exists but no linked resident
- Resident detail page shows ticket stats (total, open) and recent invoices with amounts
- Building and unit names are clickable links to their respective detail pages

---

## Phase 8 - Safety, Staff & Automated Billing (In Progress)

### Slice 1: Staff Management ✅

- [x] Prisma schema: `StaffRole` enum + `Staff` model (societyId, name, role, email, phone, isActive, soft-delete, indexes) - done 2026-08-31
- [x] Migration `20260831010000_add_staff_management` (additive only) - done 2026-08-31
- [x] Shared types: `StaffRole` enum, `StaffRoleValues`, `STAFF_ROLE_LABELS`, `CreateStaffSchema`, `UpdateStaffSchema`, `StaffResponse` - done 2026-08-31
- [x] Permissions: `staff` resource (CRUD for admins, read for residents) - done 2026-08-31
- [x] Backend: Full CRUD at `/api/v1/staff` + `/api/v1/staff/on-duty` (tenant-scoped, Zod validated, audit logged) - done 2026-08-31
- [x] Frontend: Admin staff management page at `/dashboard/admin/staff` (add, edit, deactivate, delete, search, filter) - done 2026-08-31
- [x] Frontend: Admin sidebar: Staff link added under Operations - done 2026-08-31
- [x] Frontend: Resident dashboard: "Staff on Duty" card showing active staff - done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Staff on-duty endpoint (`GET /api/v1/staff/on-duty`) is accessible to all authenticated users (residents included)
- Active filter shows only `isActive: true` staff; admin page shows all with toggle
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 2: Targeted Notifications ✅

- [x] Prisma schema: `Notice.targetType` (ALL_UNITS | SPECIFIC_UNITS) + `Notice.targetUnitIds` (JSON array of unit IDs) - done 2026-08-31
- [x] Migration `20260831020000_add_notice_targeting` (additive only, defaults to ALL_UNITS) - done 2026-08-31
- [x] Shared types: `CreateNoticeSchema` + `UpdateNoticeSchema` with `targetType` + `targetUnitIds` fields - done 2026-08-31
- [x] Backend: Notice create/update routes accept targeting fields - done 2026-08-31
- [x] Backend: Notice list endpoint filters by targeting for residents (ALL_UNITS or their specific unit) - done 2026-08-31
- [x] Backend: Notice detail endpoint checks targeting for residents - done 2026-08-31
- [x] Frontend: Admin notice form with "Target Audience" toggle (All Units / Specific Units) + unit multi-select - done 2026-08-31
- [x] Frontend: Notice cards show target badge (All units / N units) - done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Targeting is opt-in: existing notices default to ALL_UNITS (backward compatible)
- Resident filtering uses application-level post-filter (Prisma JSON path queries don't support array_contains cleanly)
- Audit log includes targetType and targetUnitIds for notice create/update
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 3: SOS Emergency Alerts ✅

- [x] Prisma schema: `SOSAlertStatus` enum + `SOSAlertCategory` enum + `SOSAlert` model (societyId, unitId, residentId, category, status, notes, resolvedByUserId, resolvedAt, indexes) - done 2026-08-31
- [x] Migration `20260831030000_add_sos_alerts` (additive only) - done 2026-08-31
- [x] Shared types: `SOSAlertStatus`, `SOSAlertCategory`, labels, `TriggerSOSSchema`, `ResolveSOSSchema`, `SOSAlertResponse` - done 2026-08-31
- [x] Permissions: `sos_alert` resource (create for residents/admins, read/update for admins) - done 2026-08-31
- [x] Notifications: `SOS_ALERT_TRIGGERED`, `SOS_ALERT_ACKNOWLEDGED`, `SOS_ALERT_RESOLVED` events with full audit trail - done 2026-08-31
- [x] Backend: `POST /api/v1/sos-alerts` (resident trigger, validates unit, notifies admins + guard staff) - done 2026-08-31
- [x] Backend: `GET /api/v1/sos-alerts` (admin list, filterable by status) - done 2026-08-31
- [x] Backend: `GET /api/v1/sos-alerts/active-count` (dashboard badge) - done 2026-08-31
- [x] Backend: `GET /api/v1/sos-alerts/:id` (admin detail) - done 2026-08-31
- [x] Backend: `PATCH /api/v1/sos-alerts/:id` (admin acknowledge/resolve with notes) - done 2026-08-31
- [x] Frontend: Resident dashboard - prominent SOS Emergency button with category picker + confirmation + sent state - done 2026-08-31
- [x] Frontend: Admin SOS alerts page at `/dashboard/admin/sos-alerts` (list, filter, detail modal, acknowledge, resolve with notes) - done 2026-08-31
- [x] Frontend: Admin sidebar - SOS Alerts link added under Operations - done 2026-08-31
- [x] Frontend: Admin dashboard - active SOS alerts shown in "Needs your attention" panel with pulse indicator - done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- SOS button is large, high-contrast (red), accessible - easy to find under stress per AGENTS.md Section 14
- Resident trigger validates unit belongs to their society before creating alert
- Admin notifications logged to console (real push/email deferred to notification provider)
- Active count endpoint powers both dashboard badge and sidebar indicator
- Full audit trail for triggered/acknowledged/resolved actions
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 4: Transfer Clearance ✅

- [x] Backend: `GET /api/v1/units/:id/transfer-check` - checks unpaid invoices, returns outstanding list + active members + primary contact - done 2026-08-31
- [x] Backend: `POST /api/v1/units/:id/complete-transfer` - re-checks invoices (safety gate), deactivates memberships, clears primary contact, comprehensive audit log - done 2026-08-31
- [x] Frontend: Unit detail page - "Transfer / Move-Out" button (red, only shown when unit has occupants) - done 2026-08-31
- [x] Frontend: Transfer clearance modal - shows unpaid invoices (blocked), active members to deactivate, primary contact to clear - done 2026-08-31
- [x] Frontend: Complete button only enabled when all dues settled, cancel button always available - done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Transfer has double safety gate: frontend checks canTransfer, backend re-checks before executing
- Audit log captures full before/after state (members, contacts, unit info)
- Route order: transfer-check and complete-transfer registered BEFORE `/:id` GET to avoid route conflicts
- Seed script has FK order issue (not related to this feature) - needs investigation
- Migration needs `prisma migrate deploy` on Railway

---

### Slice 5: Automated Recurring Billing ✅

- [x] Prisma schema: `Society.billingDayOfMonth` (nullable Int, 1-28) + `Invoice.billingPeriod` (nullable String) + unique constraint on (societyId, unitId, billingPeriod) for idempotency - done 2026-08-31
- [x] Migration `20260831040000_add_recurring_billing` (additive only) - done 2026-08-31
- [x] Shared types: `UpdateBillingSettingsSchema` with `billingDayOfMonth` field - done 2026-08-31
- [x] `backend/src/lib/recurring-billing.ts` - pure billing logic: generates invoices for all active units, idempotent via billingPeriod unique constraint + P2002 race condition handling - done 2026-08-31
- [x] `RECURRING_BILLING_GENERATED` notification event with full audit trail - done 2026-08-31
- [x] BullMQ job: monthly repeatable (1st of month 08:00 UTC, `RECURRING_BILLING_CRON` override), starts on boot alongside due-reminder job - done 2026-08-31
- [x] Settings API: `PATCH /api/v1/settings` now accepts `billingDayOfMonth`, `POST /api/v1/settings/run-billing` manual trigger - done 2026-08-31
- [x] Frontend: Admin invoices page - "Recurring billing" card with day-of-month dropdown + Save + "Generate now" button - done 2026-08-31
- [x] Idempotency verified: first run creates 5 invoices, second run skips all 5 - done 2026-08-31
- [x] Full test suite: 99/99 passing

**Notes:**
- Billing day limited to 1-28 to avoid month-end issues
- Invoice amount defaults to 0 - admin sets amounts per invoice after generation
- Due date set to billingDay + 7 days
- Invoice number format: BILL-YYYYMM-NNN (sequential per period)
- This job CREATES invoices; Phase 7's dues-reminder job REMINDS about existing invoices - both coexist
- Seed script fixed: FK delete order corrected, now runs cleanly
- Migration needs `prisma migrate deploy` on Railway

---

## Phase 8 - Complete ✅

All 5 slices implemented and tested:
1. Staff Management ✅
2. Targeted Notifications ✅
3. SOS Emergency Alerts ✅
4. Transfer Clearance ✅
5. Automated Recurring Billing ✅

---

## Bulk CSV Import (Buildings + Units) ✅

### Slice: CSV Import for Units & Buildings

- [x] Installed `papaparse` + `@types/papaparse` in backend - done 2026-09-10
- [x] Shared types: `CSVUnitRowSchema` (reuses same validation as manual unit form), `CSV_IMPORT_MAX_ROWS`, `CSV_IMPORT_MAX_FILE_SIZE_BYTES`, `CSV_IMPORT_HEADERS`, `CSVValidateResult`, `CSVImportJobResult` - done 2026-09-10
- [x] Backend: `POST /api/v1/import/validate` - parses CSV (papaparse with header: true), validates every row with shared Zod schema, checks duplicates against existing units, returns `{toCreate, toSkip, errors, totalRows}` - NO DB writes - done 2026-09-10
- [x] Backend: `POST /api/v1/import/confirm` - accepts validated rows, re-validates server-side, creates buildings if new + units, returns `{jobId, status, created, skipped, errors}` - done 2026-09-10
- [x] Backend: `GET /api/v1/import/status/:jobId` - poll job progress (in-memory job store with 30min TTL) - done 2026-09-10
- [x] Backend: `GET /api/v1/import/sample-csv` - downloadable template CSV generated from same headers as validation schema - done 2026-09-10
- [x] Frontend: "Import CSV" button on admin units page - modal with 4-step flow: Upload → Preview → Importing → Done - done 2026-09-10
- [x] Frontend: Preview shows toCreate/toSkip/errors counts, skipped/error details, preview table of first 10 rows - done 2026-09-10
- [x] Frontend: Download sample CSV button in the import modal - done 2026-09-10
- [x] Idempotency verified: second import of same rows skips all (0 created, N skipped) - done 2026-09-10
- [x] Error validation: catches missing building name, missing unit number, out-of-range floor, invalid bedroom type, invalid email - done 2026-09-10
- [x] RBAC: residents get FORBIDDEN on validate/confirm - done 2026-09-10
- [x] Audit trail: single `CSV_IMPORT_COMPLETED` entry per import (societyId, counts) - done 2026-09-10
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

Goal: every route/form validates input at the boundary with clear `{ data: null, error }` responses. No business logic or data-model changes - restrictive additions only.

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
- [x] `PATCH /api/v1/documents/:id` - was taking raw `req.body` with NO validation at all (only route found with no Zod); now parses `UpdateDocumentSchema` - done 2026-09-03
- [x] Visitor gate log `POST /visitors/:id/gate` - body now Zod-validated: `action` must be ENTRY/EXIT, `notes` optional max 500 (was a manual cast + action check, notes unvalidated)
- [x] Units (inline schemas): `floor` bounded 0–500; primaryContactName min/max 100 (no empty strings); primaryContactEmail max 200; primaryContactPhone max 30; bedroomType nullable on create (so an unselected dropdown doesn't 400)
- [x] Document uploads: server-side MIME allowlist (PDF/Office/text/CSV/images) added to the 50 MB multer limit; upload errors (e.g. file too large) now map to clean 400 `VALIDATION_ERROR` responses instead of 500s
- [x] Ticket + parcel photo-serve endpoints: filename must match the sanitized upload charset - blocks path-traversal (`../`) attempts (was `path.join` straight from user input)
- [x] Error handler duck-types ZodErrors (name + issues array) in addition to `instanceof` - robust when two zod copies are in the module graph (vitest does this; prod via tsx has one copy)

### Frontend (mirror only - server is the source of truth)
- [x] `maxLength`/bound attributes added to mirror the new server caps: notice title/content, ticket title/description + comment boxes, invoice title/description, staff name/email/phone, invite name/email, visitor name/phone/email/vehicle/purpose, unit number/floor/contact fields
- [x] Admin invoices: amount input `min="0.01"` (was `min="0"`, letting 0 through to a server 400); submit now pre-checks positive amount + due date with a clear inline error
- [x] Unit edit form: contact email/phone are now fetched from the unit detail before editing - previously they were always blank on edit and a save would silently wipe existing primary-contact data

### Tests
- [x] New hermetic `backend/src/routes/validation.test.ts` (18 tests, no real DB): rejects over-limit signup password/society name, notice content > 10k, non-UUID targetUnitIds, ticket description > 5k (create + update), comment > 2k, unit floor 501 / −1 / bad contact email, document PATCH bad folderId + empty name (valid rename accepted), gate action not ENTRY/EXIT + notes > 500 (valid ENTRY accepted), and `..%2F` photo-filename traversal (400)
- [x] Full test suite: 117/117 passing (99 pre-existing + 18 new)

**Notes:**
- Flagged, NOT fixed (out of scope for a validation pass): invoice `PATCH` allows arbitrary status transitions (e.g. PAID-adjacent flows rely on route checks only on PAID); audit-log `page` query param isn't clamped (garbage → 500). Both are business-logic/robustness, not input-validation.
- No DB migration was needed - every change is schema-level (Zod) or route-level.

---

## Google Sign-In (additional auth method) ✅

### Slice: Google Sign-In via Google Identity Services (GSI)

- [x] Prisma schema: `User.passwordHash` now nullable (Google-only accounts), `User.googleId` (unique, nullable), `User.emailVerified` (default false) - done 2026-09-11
- [x] Migration `20260911000000_add_google_auth` (additive only; `passwordHash` drop-NOT-NULL is backfill-safe; verified applied against dev DB) - done 2026-09-11
- [x] `google-auth-library` installed in backend - done 2026-09-11
- [x] `backend/src/lib/google-auth.ts` - `verifyGoogleIdToken()` verifies signature/audience/expiry via Google's official lib; wraps failures into `AppError(401 INVALID_CREDENTIALS)`; requires `GOOGLE_CLIENT_ID` - done 2026-09-11
- [x] Shared helpers in `backend/src/lib/auth.ts`: `setAuthCookies()` / `clearAuthCookies()` (used by login, signup, refresh, logout, google) and `createSocietyWithFirstAdmin()` (the single tenant-onboarding transaction reused by password signup AND Google signup) - done 2026-09-11
- [x] `POST /api/v1/auth/google` - accepts `{ idToken, mode: 'signin' | 'signup' }` (+ `societyName`/`societySlug` for signup):
  - `signin`: links Google account to an existing User by verified email (sets `googleId` + `emailVerified`, audit `GOOGLE_ACCOUNT_LINKED` per active society) and issues the app's own tokens exactly like login. **Unknown email → 401, NO user/membership is ever silently created.** Already-linked accounts log in without re-linking. Defensive 409 if the email is bound to a different Google account.
  - `signup`: same transaction as password signup - creates Society + first COMMITTEE_ADMIN User (with `googleId`, `emailVerified: true`, no password) + Membership + `SOCIETY_CREATED` audit; same 409 conflicts for existing email/slug.
- [x] Password login now guards `passwordHash === null` (Google-only accounts can't use a password) - done 2026-09-11
- [x] Frontend: `frontend/src/components/auth/google-sign-in-button.tsx` (GSI script loaded once, typed `window.google`) - done 2026-09-11
- [x] Login page: Google button above the form, same redirect logic as password login, green "accounts linked" banner when `linked: true` - done 2026-09-11
- [x] Signup page: Google button (requires society name + URL first), creates Society + first admin and redirects to `/dashboard/admin` - done 2026-09-11
- [x] `frontend/src/lib/api.ts`: `auth.googleSignIn(idToken)` / `auth.googleSignUp(idToken, societyName, societySlug)` - same token storage as login/signup - done 2026-09-11
- [x] `.env.example` updated: backend `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (comment → Google Cloud Console); new `frontend/.env.example` with `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - done 2026-09-11
- [x] Tests: 133/133 passing (12 new route tests + 4 new lib tests - new-user signup flow, existing-user linking, unknown-email rejection without creation, tampered token, already-linked, different-Google-account 409, signup conflicts, missing fields, Google-only user can't password-login) - done 2026-09-11
- [x] Live-verified: migration applied to dev DB; `POST /api/v1/auth/google` rejects a fake token with real Google verification → `401 INVALID_CREDENTIALS` - done 2026-09-11

**Notes:**
- GSI flow uses the ID-token pattern (no backend redirect/callback route): frontend renders the Google button, sends the signed ID token to `/api/v1/auth/google`, backend verifies it and issues its own JWT access/refresh tokens - Google's token is used once and never becomes the session token
- There is no invite-link/token signup flow in the app (invites create the User row directly), so invited Google users are handled by the signin path (existing email → link + login)
- **Human action needed:** the real `frontend/.env` had `GOOGLE_CLIENT_ID` but Next.js only inlines `NEXT_PUBLIC_*` vars into client components - the `NEXT_PUBLIC_GOOGLE_CLIENT_ID` key was appended to `frontend/.env` (same public client ID). On Railway/prod, add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the frontend env and ensure the Google Cloud Console OAuth client's Authorized JavaScript origins include the deployed origin
- `GOOGLE_CLIENT_SECRET` is documented but unused (ID-token verification doesn't need it) - only needed if a server-side OAuth flow is added later

### Fix: Google button missing on the deployed site (Vercel + Render) - 2026-09-12

- **Not a code bug** - there is no localhost-specific logic. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is inlined at **build** time, so a build produced before that variable existed on the host renders no button (the component returns `null`). Confirmed by inspection: the button is rendered unconditionally on both `/login` and `/signup`; the only condition is the env var.
- [x] `google-sign-in-button.tsx` no longer fails *silently*: it logs an explicit `console.error` naming the variable and the redeploy requirement when the client ID is absent, and it now detects GSI's silent render failure (unauthorized origin → empty container) and shows the visible "Google Sign-In failed to load" message instead of a blank gap - done 2026-09-12
- [x] `docs/MANUAL_TEST_GUIDE_GOOGLE_AUTH.md` rewritten to a 4-step deployment checklist (Vercel `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_API_URL` → **redeploy** → Google Cloud Console Authorized JavaScript origins incl. the Vercel origin → Render `GOOGLE_CLIENT_ID`/`FRONTEND_URL`) with a symptom→cause table - done 2026-09-12
- [x] **Runtime client-ID fallback (real fix, not just diagnostics):** new public `GET /api/v1/auth/google/config` returns the backend's `GOOGLE_CLIENT_ID` (public by design). `google-sign-in-button.tsx` now uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID` when present, otherwise fetches the ID from that endpoint - so the button renders on Vercel **even if the build env lacks the variable**, as long as Render has `GOOGLE_CLIENT_ID`. Verified live: `GET /api/v1/auth/google/config` → `{"data":{"clientId":"3015...apps.googleusercontent.com"},"error":null}` - done 2026-09-12
- [x] Tests: backend 161/161 (2 new for the config endpoint: returns the configured ID / returns null when unset) - done 2026-09-12
- **Still requires human action (cannot be done from the repo):** add the deployed Vercel origin to the OAuth client's **Authorized JavaScript origins**, and ensure Render has `GOOGLE_CLIENT_ID` + Vercel has `NEXT_PUBLIC_API_URL`. The fallback only covers the missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

---

## Password Reset ✅

### Slice: Forgot / Reset Password (both account types)

- [x] Prisma schema: `User.tokenVersion` (default 0, bumped on reset) + `PasswordResetToken` model (userId, tokenHash @unique, expiresAt, usedAt, createdAt); migration `20260912000000_add_password_reset` (additive, defaulted - verified applied against dev DB) - done 2026-09-11
- [x] `backend/src/lib/email.ts` - **`EmailProvider` interface + `GmailSmtpEmailProvider` (Nodemailer over Gmail SMTP), per ADR 004** (see the migration slice below; Resend was removed 2026-09-12 after delivery issues). `sendEmail()` is the only entry point feature code uses; SMTP transport config lives only inside the concrete provider - done 2026-09-12
- [x] `backend/src/lib/password-reset.ts` - 256-bit CSPRNG token (`crypto.randomBytes`), only its SHA-256 hash is stored; TTL via `PASSWORD_RESET_TOKEN_TTL_MINUTES` (default 45); reset-email + Google-only-email template builders (TTL printed from config, not hard-coded) - done 2026-09-11
- [x] `backend/src/lib/rate-limit.ts` - in-memory fixed-window limiter + `passwordResetEmailLimiter` (5 / 15 min per email) and `passwordResetIpLimiter` (20 / 15 min per IP); new `RATE_LIMITED` error code (429) - done 2026-09-11
- [x] `POST /api/v1/auth/forgot-password` `{ email }` - password accounts get a single-use reset link; **Google-only accounts (passwordHash null) get an informational "your account uses Google Sign-In" email - no reset link, no token, no password is ever created**; expired tokens pruned on new requests - done 2026-09-11
- [x] `forgot-password` response behavior (revised 2026-09-12 at the product owner's explicit request): unknown email → `404 EMAIL_NOT_FOUND`, password account → `200` "reset link sent", Google-only → `200` + `googleOnly: true`. This intentionally **deviates from the spec's enumeration-prevention rule** to surface a clear error in the UI; the product owner accepted that trade-off. (Original implementation returned an identical generic 200 for all cases.) - done 2026-09-12
- [x] SMTP send failures are now surfaced as `502 EMAIL_SEND_FAILED` instead of a misleading "check your inbox" success; the sender catches provider errors, logs them with credentials scrubbed, and the response envelope carries the error - done 2026-09-12
- [x] `POST /api/v1/auth/reset-password` `{ token, password }` - validates token (exists / not expired / not used), atomic transaction (updateMany `usedAt: null` guard prevents double-spend + new bcrypt passwordHash + `tokenVersion` increment), deletes all other outstanding tokens for the user, audits `PASSWORD_RESET` per active society (never the password) - done 2026-09-11
- [x] Refresh tokens now carry a `tokenVersion` claim; `/refresh` rejects tokens that don't match the user's current version (`payload.tokenVersion ?? 0` keeps pre-change tokens working) → a reset force-logs-out every other session - done 2026-09-11
- [x] Shared: `ForgotPasswordSchema`, `ResetPasswordSchema` (password rules match SignupSchema: 8–128) - done 2026-09-11
- [x] Frontend: `/forgot-password` page (email → generic success), `/reset-password` page (reads `?token=`, new password + confirm → success → login), "Forgot password?" link on login page, `auth.forgotPassword` / `auth.resetPassword` in `api.ts` - done 2026-09-11
- [x] `.env.example` updated: `GMAIL_USER` / `GMAIL_APP_PASSWORD` (+ Google App Passwords link) and `PASSWORD_RESET_TOKEN_TTL_MINUTES`; Resend vars (`RESEND_API_KEY`, `EMAIL_FROM`) removed - done 2026-09-12
- [x] Tests: 159/159 passing (26 new across the slice: 14 route + 5 rate-limiter + 3 email-provider/entry-point + 2 SMTP-failure route tests + 2 Google-auth-era additions: end-to-end reset with hashed-token-at-rest check, expired token, already-used token, double-spend race, unknown/tampered token, Google-only email variant, weak password, 429 rate limit, tokenVersion refresh acceptance/rejection incl. legacy tokens, transport config/error-scrubbing, provider-failure → 502) - done 2026-09-12
- [x] Live-verified against dev DB: migration applied; forgot-password generic response for unknown email; reset flow changed admin's password (old dead, new works), bumped tokenVersion 0→1, consumed the token, wrote `PASSWORD_RESET` audit; restored `admin123` via a second reset and confirmed no leftover unused tokens - done 2026-09-11

### Slice: Email delivery - Resend → Nodemailer / Gmail SMTP (ADR 004)

- [x] `resend` uninstalled (gone from `package.json` + lockfile); `nodemailer` + `@types/nodemailer` installed - done 2026-09-12
- [x] `backend/src/lib/email.ts` rewritten as an `EmailProvider` abstraction - never call Nodemailer from feature code; SMTP host/port/auth live only inside `GmailSmtpEmailProvider`; connection/greeting/socket timeouts bound every send so a stalled SMTP connection can't hang a request - done 2026-09-12
- [x] Provider errors are sanitized (app password + `pass=...` redacted, message truncated) before logging; `getEmailProvider()` lazily constructs the transport so the app/tests run without credentials - done 2026-09-12
- [x] `backend/.env` cleaned of the leftover `RESEND_API_KEY` / `EMAIL_FROM` lines (Gmail creds already present) - done 2026-09-12
- [x] New `EMAIL_SEND_FAILED` error code; `forgot-password` translates provider rejections into a non-misleading 502 - done 2026-09-12
- [x] Tests added: `backend/src/lib/email.test.ts` (transport config, message passthrough, password scrubbing, missing-credentials path, failure propagation); route tests for 502 on provider failure (both account types) - done 2026-09-12
- [x] **Live-verified real delivery**: sent an actual email through the provider to the configured Gmail inbox (accepted by Gmail SMTP), then ran the endpoint E2E against a temp user - password account → 200 + token row with future expiry, unknown email → 404, Google-only → 200 `googleOnly` with **zero** tokens created; temp user/tokens cleaned up - done 2026-09-12

**Notes:**
- Manual end-to-end (real inbox) now needs only the Gmail creds: `GMAIL_USER` + `GMAIL_APP_PASSWORD` (Google Account → Security → App passwords) in `backend/.env`. Unlike Resend's sandbox, Gmail SMTP can send to any address - see `docs/MANUAL_TEST_GUIDE_PASSWORD_RESET.md`
- **Dev-env gotcha (fixed 2026-09-12):** `backend/.env` had `PORT=8080` while `docker-compose.yml` publishes `4000:4000` and `api.ts` defaults to `localhost:4000`, so every frontend API call failed with the generic "An unexpected error occurred" (network error, not a 500). Aligned `PORT=4000`. Reminder: `docker restart` does **not** re-read `env_file` - use `docker compose up -d backend --force-recreate` after editing `backend/.env`.
- Rate limiter is in-memory (single instance today); PLAN.md §5's Redis-backed limiter is the documented end-state - same `check()` API, contained swap
- Reset does not auto-login; the user signs in with the new password (all old refresh tokens are dead by design)
- Judgment call: the spec offered an optional "allow Google-only accounts to add a password too" path; I chose the conservative option - Google-only accounts only get the Sign-in-with-Google email, no password creation

---

## Vendor Ticket Magic Link (no-login vendor status updates) ✅

### Slice: Assign a vendor → they get a token-secured link → they update the ticket

Closes the gap where vendors had no way to learn about an assignment and admins relayed every status change by hand. Vendors still have **no accounts** (PLAN.md §13) - the token is the credential. See **ADR 005** for the security model.

- [x] Prisma schema: `Ticket.vendorEmail`, `Ticket.vendorAccessTokenHash` (unique), `Ticket.vendorAccessTokenIssuedAt`; migration `20260913000000_add_vendor_access_token` (additive + nullable → backfill-safe) - done 2026-09-13
- [x] Shared: `UpdateTicketSchema.vendorEmail`; `VendorStatusUpdateValues`/`VendorStatusUpdateSchema`; `VendorTicketView`; `TicketResponse.vendorEmail` + `vendorLinkSent` - done 2026-09-13
- [x] `backend/src/lib/vendor-access.ts` - 256-bit CSPRNG token (`crypto.randomBytes(32)`, base64url), **only the SHA-256 hash persisted**; magic-link URL from `FRONTEND_URL`; absolute photo URLs from `API_PUBLIC_URL`; assignment email template; the vendor transition table - done 2026-09-13
- [x] Token is deliberately **not single-use and not time-limited** (the vendor returns over several days); it is invalidated by ticket state instead - rotated on reassignment, cleared on unassign, and denied on CLOSED by an explicit status check (the hash is intentionally kept on closure so the vendor is told *"this ticket has been closed"* rather than getting a generic invalid-link error; a future "reopen" path must rotate the token) - done 2026-09-13
- [x] `backend/src/routes/vendor-portal.ts` (public, no auth) - `GET /api/v1/vendor/ticket/:token` (limited view) and `PATCH /api/v1/vendor/ticket/:token/status` - done 2026-09-13
  - Lookup is by token hash, which is a **unique column on the Ticket row** → structurally scoped to one ticket + society + vendor; the route also fails closed on `deletedAt`, missing `assignedTo`, and `CLOSED`, and never accepts a ticket id from the client
  - View exposes only reference/society/title/description/category/unit/photos/status - no resident name/email/phone, no financial data, no comments, no other tickets
  - Vendor transitions limited to `ASSIGNED → IN_PROGRESS → RESOLVED`; `CLOSED` stays admin-only (it captures the Phase 7 rating)
- [x] Audit: `TICKET_STATUS_UPDATED_BY_VENDOR` with `actorUserId: null` and `after.vendor` / `after.via` so vendor actions are unmistakably attributed to the vendor, not a user - done 2026-09-13
- [x] Rate limiting: `vendorTokenIpLimiter` (60/15min) + `vendorTokenLookupLimiter` (30/15min, keyed by token **hash**) - done 2026-09-13
- [x] `PATCH /api/v1/tickets/:id` - assigning/reassigning with an email issues + rotates the token and sends the email through the shared `EmailProvider` (ADR 004); closing or unassigning revokes it; reassigning **never** falls back to the previous vendor's address - done 2026-09-13
- [x] A failed assignment email returns **502 `EMAIL_SEND_FAILED`** (the assignment is saved) rather than a success the admin would misread as "the vendor knows" - done 2026-09-13
- [x] Frontend: public page `frontend/src/app/vendor/ticket/[token]/page.tsx` (no login, mobile-friendly, photos, Start work → Mark as resolved with confirm) + `vendorPortal` client in `api.ts` - done 2026-09-13
- [x] Frontend: admin ticket page - vendor email field, Reassign flow, "link emailed" confirmation, assigned-vendor email shown on the ticket - done 2026-09-13
- [x] `.env.example`: documented `API_PUBLIC_URL` (absolute links in emails) and clarified `FRONTEND_URL` + the Gmail vars' role - done 2026-09-13
- [x] Tests: **178/178 passing** (17 new - valid token view, malformed token never hits the DB, wrong-ticket token, closed-ticket denial + "ticket has been closed" message, unassigned denial, token rate limit, vendor transitions incl. CLOSED rejection and skipped transitions, audit attribution, hash-at-rest issuance, reassignment rotation, no email reuse on reassign, closure ends vendor access, 502 on email failure) - done 2026-09-13
- [x] `docs/adr/005-vendor-magic-link-access.md` written (security model + why the token is hashed, non-expiring, and can't close a ticket) and `docs/MANUAL_TEST_GUIDE_VENDOR_TICKET_LINK.md` added - done 2026-09-13
- [x] **Live-verified against the dev DB** (migration applied via `prisma migrate deploy`; no live session could be run until Docker was started): assigned a real ticket to a real vendor inbox → `200` + `vendorLinkSent: true` + a 64-char SHA-256 hash stored (raw 43-char token absent from the DB); `GET /vendor/ticket/:token` → `200` with only the limited fields (no resident data); vendor `IN_PROGRESS` → `200`, `CLOSED` → `400`, `RESOLVED` → `200`, transition-after-RESOLVED → `400`; audit rows show `actorUserId` NULL with `after.vendor` + `via: vendor_magic_link`; reassignment → hash rotated and the **old link 404s**; after the admin closed the ticket the link returns the **"ticket has been closed"** message - done 2026-09-13
- [ ] **Still to confirm by hand:** that the assignment email actually lands in a real inbox and its button opens the vendor page end-to-end (the API side is verified; the inbox is yours to check) - see `docs/MANUAL_TEST_GUIDE_VENDOR_TICKET_LINK.md`

**Notes:**
- The link is a bearer credential - anyone it's forwarded to can update the ticket. Stated in the email and on the page, and revocable by reassigning or closing.
- Migration needs `prisma migrate deploy` on Render.
- Set `API_PUBLIC_URL` to the Render URL in production, or the email's photo links point at `localhost:4000`.

---

## Dashboard Polish - FAQs + duplicate logo fix ✅

- [x] **Duplicate logo fixed:** each dashboard shell (`admin-shell`, `resident-shell`, `guard-shell`) rendered `logo3.png` in **both** the sidebar and the sticky top bar, so every dashboard page showed two logos on desktop. Removed the top-bar `<img>`; the sidebar keeps the logo + OmniHome wordmark as the single brand lockup, and the top bar is now society-name + role context only (also removes the duplicated mark on mobile) - done 2026-09-13
- [x] **FAQs moved to dedicated sidebar pages** - `FAQSection` (accordion, same visual language as the landing page's FAQ) plus `ADMIN_FAQS` / `RESIDENT_FAQS` / `GUARD_FAQS` in `frontend/src/components/faq-section.tsx`; new pages `/dashboard/admin/faqs` and `/dashboard/resident/faqs`, guard FAQ view inside the existing `[[...view]]` catch-all (`/dashboard/guard/faqs`), each linked from its shell's sidebar as "FAQs". Dashboard **home pages no longer render FAQs** (initially added there, then removed per user preference) - done 2026-09-13
- [x] FAQ answers describe *actual* implemented behaviour (CSV import, recurring billing vs dues reminders, the vendor no-login job link, transfer clearance, targeted notices, audit/analytics, SOS recipients, QR check-in, parcels, polls, Google-only password reset) - **keep these in sync when a feature changes** - done 2026-09-13
- [x] Frontend typecheck + `next build` clean; all three dashboard routes compile and serve (verified `HTTP 200`); FAQ content confirmed present in each dashboard's build chunk - done 2026-09-13

**Notes:**
- Chose to keep the **sidebar** logo (brand) and drop the **top-bar** logo (context) - trivially reversible if the opposite is preferred.
- Do not run `next build` while a `next dev` server is running against the same `.next` directory: it briefly 500s the dev server until it recompiles (observed, recovered on its own).

---

## Phase 9 - Platform Billing (Society Subscription) ✅

Societies paying the PLATFORM (ADR 006) - entirely separate from resident dues (Phase 2 `Invoice`/Safepay). Progressive per-unit pricing: first 15 units free, 16–50 → Rs 20/u, 51–200 → Rs 12/u, 201–500 → Rs 8/u (worked examples: 50 → Rs 700, 100 → Rs 1,300, 200 → Rs 2,500, 500 → Rs 4,900). No feature-gating anywhere; no account restriction on overdue (notification only).

- [x] Rate table as CONFIG - `backend/src/config/platform-pricing.ts` (bands + cap); price changes are a config edit, not code - done 2026-09-14
- [x] Prisma: `PlatformInvoice` (societyId, billingPeriod, unitCountSnapshot, calculationBreakdown JSON, totalAmountPaisa, status PENDING/PAID/OVERDUE, dueDate, generatedAt, paidAt, markedPaidBySuperAdminUserId, soft-delete, `@@unique([societyId, billingPeriod])` for idempotency) + `PlatformCustomQuoteFlag` (501+ societies, unique per society+period); migration `20260914000000_add_platform_billing` (additive) - done 2026-09-14
- [x] `backend/src/lib/platform-billing.ts` - generation (≤15 units skipped silently; 501+ flagged for custom quote, never auto-invoiced; dry-run support; P2002 race-safe), overdue sweep (mark + reminder email to Committee Admins via EmailProvider per ADR 004), mark-as-paid (the ONLY path to PAID; records paidAt + super admin id + audit) - done 2026-09-14
- [x] BullMQ jobs: monthly generation (`0 8 1 * *`, `PLATFORM_BILLING_CRON`) + daily overdue check (`0 9 * * *`, `PLATFORM_OVERDUE_CRON`), same graceful-disable pattern as Phase 7/8 queues - done 2026-09-14
- [x] Routes `/api/v1/platform-billing` - `GET /` (own society, read-only, admins), `GET /all` + `GET /custom-quotes` + `POST /run-generation` (dryRun default off, body-controlled) + `POST /run-overdue-check` + `PATCH /:id/mark-paid` - the last four re-checked server-side as SUPER_ADMIN **membership role** on every request; no self-service "I paid" for Committee Admins - done 2026-09-14
- [x] Frontend `/dashboard/admin/platform-billing` - **status banner for every tier** (`GET /status`: free tier → "You're on the free tier 🎉" with unit count + what happens when they grow; 501+ → custom-pricing notice; billable → estimated fee today), payment instructions with `[BANK DETAILS PLACEHOLDER - TO BE PROVIDED]` (hidden on the free tier - nothing to pay), own-society invoice cards with expandable progressive breakdown (transparency), ops panels (dry run / generate / overdue check, custom-quote list, all-societies list with Mark as paid) probed via 403, not assumed; sidebar link "Platform billing" under Finance & Records - done 2026-09-14
- [x] Shared types: `PlatformInvoiceStatus`, `PlatformInvoiceResponse` (breakdown + rupees + paisa), `PlatformCustomQuoteFlagResponse`, `PlatformBillingRunResult`, `PlatformOverdueResult`, `MarkPlatformInvoicePaidSchema`; permissions resource `platform_billing` (read: admins only) - done 2026-09-14
- [x] Tests: **211/211 passing** (33 new - pricing worked examples 50/100/200/500 + strictly-increasing sweep 1..500 + band boundaries 16/51/201; route tests for tenant scoping, resident 403, super-admin gates on every ops endpoint, mark-paid flow incl. 409 double-mark, generation dry-run writes nothing, 501+ flag path, free-tier skip, overdue emails, status endpoint free-tier/billable/403) - done 2026-09-14
- [x] Manual test guide: `docs/MANUAL_TEST_GUIDE_PLATFORM_BILLING.md` (migration + SUPER_ADMIN seeding SQL, dry-run-first flow, progressive totals table, idempotency checks, custom-quote flag setup/teardown, cross-tenant curl checks, overdue email test) - done 2026-09-14

**Notes:**
- SUPER_ADMIN here is a **membership role**, not a global account - ops surfaces are gated on it per-request server-side; the UI hides them for non-ops but the server is the enforcement point
- First production run should use the **dry run** button (and/or `POST /run-generation {"dryRun":true}`) so no wrong invoices are generated on day one
- Amounts stored in paisa (rupees × 100), same convention as `Invoice.amount`; breakdown JSON shows band-level math for the admin view
- Migration needs `prisma migrate deploy` on Render; no new required env vars (cron overrides optional)

---

## 2026-09-14 - Homepage Pricing Aligned with ADR 006

- Landing page **feature-row visuals rebuilt** as four live-looking product panels (they were plain lists). Extracted to `frontend/src/components/feature-visuals.tsx` with a shared `useReveal()` / `useCountUp()` pair so all four behave identically (reveal once on first scroll into view via `IntersectionObserver`, count-up with a `setTimeout` safety net so a stalled frame loop can never leave a figure at zero, all motion skipped under `prefers-reduced-motion`):
  - **01 Payments** - pulsing "September collection" header with an SVG collection ring, gradient count-up (`Rs 25,000 of Rs 50,000`), animated progress rail with a travelling sheen, unit rows with initialled avatars + status pills + a human note ("Paid today", "Reminder sent"), and a floating "Payment received" toast straddling the panel's top edge. Mock arithmetic fixed (2 of 4 units paid at Rs 12,500 is Rs 25,000 - the old panel said "Rs 50,000 collected" with 2/4 paid)
  - **02 Maintenance** - "Service desk" header with a % resolved chip, count-up of tickets closed out of 12, a resolution rail, and ticket rows with a coloured status rail down the leading edge, an Urgent tag, an assignee/SLA line and a photo-count chip
  - **03 Visitors** - a real perforated pass stub on a tinted header, a generated pseudo-QR (three finder squares + hashed modules, stable not random) with an animated scan-line sweep, an "Active" pulse chip, a checked-in line, and a "Scanned at Gate 2" floating toast
  - **04 Amenities** - a tinted month grid with today filled and a busy-day dot, plus a facility ledger with per-slot occupancy bars and an "N slots still open this month" footer
  - Shared chrome keeps them reading as one product: live header (pulse dot + label + chip) and a footer line carrying the product promise; one new `scan` keyframe added to `tailwind.config.js` for the QR sweep. The shared `FeatureRow` shell was **not** touched, so the layout/copy columns are unchanged. Verified: frontend typecheck clean, all four panels render at 1440px and 390px in headless Chrome, count-ups land (`Rs 25,000`, `10`), and `animate-scan`/`animate-ping`/`animate-shimmer` + their keyframes are present in the generated CSS. (Production `next build` deliberately not run - it would clobber the running dev server's `.next`)
- Landing page pricing section rewritten to match the real pricing model (was fictional flat tiers: Starter Free "up to 50 units" / Pro Rs 2,000 / Enterprise Rs 5,000 with feature gating - contradicting ADR 006):
  - **Starter** - Free, up to 15 units forever, every feature included
  - **Growth** - headline **Rs 700/mo** (a 50-unit society), with 100 → Rs 1,300 and 200 → Rs 2,500 in the bullets; progressive math and first-15-free explained, "Most popular"
  - **Scale** - headline **Rs 3,300/mo** (a 300-unit society), with 500 → Rs 4,900 in the bullets; 501+ → custom quote
  - Revision: per-unit rates were removed from card headlines after review ("Rs 20/unit" read as trivially cheap) - real calculated monthly totals are now the headline, per-unit bands remain only in the explanatory bullets and FAQ
- Section heading/copy now states progressive per-unit pricing and the ADR 006 no-feature-gating rule ("Every plan includes every feature")
- Hero sub-line and final CTA updated: "Free for up to 15 units · No credit card required" (was "14-day free trial")
- Landing FAQ: added "How does pricing work?" (full progressive breakdown); reworded white-label answer (was "Enterprise plans include…" - tier no longer exists)
- `PricingCard` component: added optional `priceSuffix` (e.g. "/unit/month") instead of hardcoded "/month"
- Verified: frontend typecheck clean; landing page serves 200 with new copy

---

## 2026-09-15 - Building CSV Import (parity with Units) ✅

- [x] Shared: `CSVBuildingRowSchema` (name, 1-100 chars, trimmed) + `CSV_BUILDING_HEADERS = ['Building Name']` - done 2026-09-15
- [x] Backend: `POST /api/v1/import/buildings/validate` - parses + validates each row, flags duplicates against existing buildings AND repeats within the same file, returns `{toCreate, toSkip, errors, totalRows, preview}` - NO DB writes - done 2026-09-15
- [x] Backend: `POST /api/v1/import/buildings/confirm` - re-validates server-side (never trusts the client copy), creates buildings, writes `BUILDING_CREATED` per row + one `CSV_IMPORT_COMPLETED` summary - done 2026-09-15
- [x] Backend: `GET /api/v1/import/buildings/sample-csv` - downloads `sample-buildings-import.csv` - done 2026-09-15
- [x] Frontend: "Import CSV" button next to "Add Building" on the admin buildings page, reusing the same 4-step modal (Upload -> Preview -> Importing -> Done) incl. sample download - done 2026-09-15
- [x] Fixed a Papa Parse quirk found while testing: single-column CSVs raise a benign `UndetectableDelimiter` error - the parser now ignores only that case so real errors still surface
- [x] Verified end-to-end against the Docker backend: sample CSV downloads, validate flags in-file duplicate, confirm creates + audits, re-validate flags all as "Building already exists", resident token gets 403
- [x] Full test suite: 211/211 passing; shared + backend + frontend typecheck clean

**Notes:**
- `requireRole('create', 'building')` guards all three endpoints - same 2 MB / 1000-row limits and BOM stripping as units
- Unlike the unit CSV, this one does not auto-create anything else - a Building holds only a name

---

## 2026-09-15 - Dashboard UI Polish (Sidebar, Cards, Filters, Modals, Resident Detail) ✅

- [x] Sidebar active state: replaced the translucent pill + blue glow with a solid **white pill and blue text** (`bg-white text-accent-700`), accent rail and active icon follow suit. Applied to the admin, resident and guard shells so the current section is unmistakable at a glance
- [x] Cards (buildings, units, residents): replaced the hover-only icon buttons with always-visible labelled buttons (Edit / Delete / Revoke). The card action row now wraps below the text on small screens, so the wider buttons cannot push the layout sideways
- [x] Units page filters: occupancy chips (All / Owner Occupied / Rented / Vacant with live counts) plus a bedroom-type dropdown (Studio .. 4+ Bedrooms, counts shown in the option label). A Clear button appears only when a filter or the search box is active, and the empty state names the filters instead of the search term alone
- [x] New `frontend/src/components/ui/Modal.tsx`: shared dialog shell (accent top rule, icon-chip header with subtitle, scrollable body, optional footer, Escape to close, body scroll lock while open). Every building / unit / resident modal now uses it; the unit form is sectioned into Location, Details and Primary contact
- [x] Resident invite dialog: the role dropdown became three selectable role cards (Resident / Guard / Vendor) with hints, and name + email sit side by side
- [x] Resident detail page (`/dashboard/admin/directory/[userId]`): rebuilt on the `#f6f8fc` canvas with a gradient initials avatar, role pill, stat tiles, a definition-list profile card, a unit panel with building / floor / bedroom chips, and ringed status pills for tickets and invoices
- [x] Verified: frontend typecheck clean, every dashboard route returns 200, the new classes are present in the served CSS, the old glow and icon-only buttons are gone from the layout chunks, zero em dashes

**Notes:**
- No API, state or navigation behaviour changed - this is presentation only
- Modal states are unchanged (same fields, same handlers, same payloads); only the wrapper chrome moved

---

## 2026-09-15 - Dashboard Alignment, Hero Third Slide, Maintenance Rebuild ✅

- [x] Admin dashboard: the "Recent tickets" panel no longer grows past its neighbour. It renders a bounded list (4 rows) and both columns now stretch to the same height (`flex flex-col h-full` + `flex-1` on the cards), with a pinned footer button that reads "View N more + all tickets" when rows were trimmed
- [x] Hero rotator: third photo added (`/building-img3.jpg`). The loop already handled N slides, so the track is now 3 photos + a duplicate of the first (4 slots) and wraps invisibly as before
- [x] Renamed `public/buiding3.jpg` to `public/building-img3.jpg` to match the existing `building-img.jpg` / `building-img2.jpg` convention (nothing referenced the old name)
- [x] Maintenance list rebuilt on the `#f6f8fc` canvas: stat tiles (in view / unassigned / with vendor / rated), a pill status filter that shows the current count, a restyled vendor-ratings panel, and cards with a status-coloured accent bar, gradient icon chip, ringed status pills, meta chips (resident, unit, category, comments, vendor) and a chevron that slides on hover
- [x] Ticket detail rebuilt as a two-column view: summary card with status rule + description block, photo gallery, and a timeline with avatar bubbles and a comment composer on the left; a status-actions card (labelled transitions: Mark assigned / Start work / Mark resolved / Close & rate), the vendor assignment card (name + email + inline rating, reassign flow, job-link notice) and a details card on the right
- [x] Fixed leftover dark-theme classes in that page (`bg-white/[0.03]` timeline rows, `text-purple-400`) that rendered nearly invisible on the light dashboard
- [x] Verified: frontend typecheck clean, `/dashboard/admin` and `/dashboard/admin/tickets` return 200, 4 hero slots with all three images served, new markup present in the compiled chunks, zero em dashes

**Notes:**
- Maintenance logic is untouched: same endpoints, same status transitions, same close-with-rating flow, same vendor magic-link assignment
- The status filter still queries the server per status, so the count badge only shows for the active filter

---

## 2026-09-15 - Staff Page Rebuild + Units Filter Alignment ✅

- [x] **Staff page bug fixed:** the add/edit form fields had no `className` at all, so the browser rendered bare inputs with no border, focus ring or padding. Name, email and phone now use the shared `fieldInput` style, and the form moved into the shared `Modal` (icon chip header, Cancel/Save footer)
- [x] **Staff search fixed:** the search input was also unstyled, so the absolutely positioned search icon sat on top of the placeholder text. It now has proper `pl-10 pr-10` padding, a grey field with a focus ring, an aria-label and a **clear (X) button** that appears while typing
- [x] **Staff page restyled:** `#f6f8fc` canvas, four stat tiles (total / active / inactive / active guards), a search + filter card with counted All / Active / Inactive pills and a Clear button, dismissible error and success banners, roster cards with a role-coloured accent bar, gradient role icon chip, role + status pills and contact chips, labelled **Edit / Deactivate / Activate / Delete** buttons (the old 3-icon row is gone), and a real empty state plus a separate no-results state
- [x] **Units filter alignment fixed:** the bedroom-type dropdown and Clear button used to share the row with the occupancy chips, so "Vacant" got squeezed onto a second line. The chips now own their row (label + All / Owner Occupied / Rented / Vacant stay on one line) and the search box, bedroom dropdown and Clear button moved to their own row below a hairline divider
- [x] Units search also gained a clear (X) button, matching staff
- [x] Verified: frontend typecheck clean, `/dashboard/admin/staff` and `/dashboard/admin/units` return 200, the new markup is in the compiled chunks, all 4 staff inputs carry a styled class, zero em dashes

**Notes:**
- Staff behaviour is unchanged: same endpoints, same payloads, same payload for create vs update, same active toggle and delete confirm
- Role icons changed for clarity (Guard / Sparkles for Cleaner / Wrench for Maintenance / HeartHandshake for Other)

---

## 2026-09-15 - Amenities Page Rebuild (Bookings in a Dialog) ✅

- [x] **Disalignment fixed:** "View bookings" used to expand the booking list *inside* the card. In the two-column grid that grew one row and stretched (or orphaned) its sibling, so the layout broke whenever a list was opened. Bookings now open in the shared `Modal`, so opening any list leaves the grid exactly as it was
- [x] **Bookings dialog:** per-amenity fetch (`?amenityId=`), sorted most recent first, with avatar initials, resident, unit, date and time, ringed status pills (Confirmed / Cancelled / Completed), a loading spinner and an empty state. The card button also shows a live booking count
- [x] **Per-card counts and stats:** all bookings are fetched once on mount (the `/amenities/bookings` endpoint accepts no filter) to power per-card badges plus header tiles (Amenities / Active / Inactive / Upcoming bookings)
- [x] **Page restyled:** `#f6f8fc` canvas, header with subtitle, dismissible error and success banners, stat tiles, and amenity cards with a status top rule, gradient icon chip, Active/Inactive pill, description, rule chips (duration, per-unit-per-day, advance notice) and labelled **View bookings / Edit / Deactivate** buttons
- [x] **Add/Edit moved into the shared `Modal`** with `fieldInput` fields and a Booking rules section (max duration, advance notice, per unit per day) instead of the old unstyled inline form
- [x] Verified: frontend typecheck clean, `/dashboard/admin/amenities` returns 200, new markup present in the compiled chunk, old expand-in-card markup (`Hide bookings`) gone, zero em dashes

**Notes:**
- Amenity behaviour is unchanged: same endpoints and payloads, same active toggle, same booking rules
- The bookings fetch on mount is read-only and best-effort; if it fails the page still renders, only the counts show zero

---

## 2026-09-15 - Notices + Visitors Rebuild (Detail Views) ✅

- [x] **Notices page restyled:** `#f6f8fc` canvas, header with subtitle, dismissible error and success banners, stat tiles (Notices / Published / Drafts / Total reads), a search + filter card with counted All / Published / Drafts pills and a Clear button, and notice cards with a category-coloured accent bar, gradient category icon chip (General / Maintenance / Event / Emergency / Billing), category + status pills, a two-line preview and meta chips (author, date, reads, audience)
- [x] **Notice detail view:** clicking any notice opens a dialog with the status row (published date / draft warning, reads, audience), the full content, an author/created/published meta table and actions (Publish now on a draft, Delete, Close)
- [x] **Notices form moved into the shared `Modal`:** the title and content fields had no `className` at all (bare browser inputs, same bug the staff page had). They now use `fieldInput`, the audience picker is a two-card choice (All units / Specific units) and the publish switch is a described toggle row
- [x] **Backend gap closed:** the admin notices list never populated `readCount`, so any read-count UI would always have shown 0. The list handler now counts `noticeReadReceipt` rows per notice for admins (verified against the live API: `readCount: 0` now returned). Read-only, additive, no schema change
- [x] **Visitors page restyled:** canvas, header with an "Open security gate" shortcut, banners, stat tiles (Total / Pending / Approved / Checked in), a search + status filter card (search has a clear button), and pass cards with a status accent bar, gradient icon chip, ringed status pills (Pending / Approved / Checked in / Checked out / Expired / Cancelled), purpose badge, meta chips (phone, unit, host, vehicle, created) and labelled **Details / Approve / Reject / Cancel** buttons
- [x] **Pass detail view:** clicking a pass opens a dialog with the status row (approved/expires), a real **QR code** rendered from the gate token via `qrcode.react` plus the token itself, a full detail table (phone, email, purpose, vehicle, unit, host, created, expected arrival/departure) and the matching actions. The QR replaces the old inline expansion, so the list no longer shifts height
- [x] Fixed an invalid-HTML bug found while building this: the pass card is a `div[role=button]` (with keyboard support) rather than a `button`, because it contains its own action buttons
- [x] Verified: frontend + backend typecheck clean, **211/211 backend tests passing** (19 files), all four notices/visitors routes return 200, new markup present in the compiled chunks, zero em dashes

**Notes:**
- Backend change is additive only: one `findMany` of read receipts for the admin list path, no migration, no resident-path change
- The backend container must be restarted for the readCount change to take effect locally (`docker restart apartment-backend`) - already done

---

## 2026-09-16 - Invoices / Platform Billing / Polls / Packages Polish ✅

- [x] **Invoices page rebuilt:** `#f6f8fc` canvas, header with subtitle and a clear primary action, dismissible banners, four stat tiles (Collected / Outstanding / Unpaid count / units billed), the Automation card split into two equal-height panels (Dues reminders, Recurring billing) with hairline section headers, a search + counted status pill bar with a Clear button, and invoice cards with a status accent bar, gradient status icon chip, ringed status pill, meta chips (invoice number, unit, due date, paid date), amount block and a labelled Delete button. Empty state names the active filter and offers both next steps
- [x] **Platform billing page rebuilt** to the same design system: stat tiles (billing Status / Active units / Unpaid / Paid), a state card for each of Free tier, Custom quote and Billable (with the estimated monthly fee), the How to pay card, and invoice cards with a status accent bar, breakdown toggle and Mark as paid. The Super Admin section now has a labelled header, a Billing runs card (Dry run / Generate / Overdue check), a Custom quotes needed card and the all-societies invoice list. No behaviour or API change
- [x] **Polls page rebuilt:** stat tiles, counted status filter pills, poll cards with accent bars and result bars, and the create-poll flow moved into the shared `Modal` (question, description, dynamic 2 to 10 options with add/remove, open and close dates, results visibility) instead of the old generic inline block
- [x] **Packages page fixed and rebuilt:** logging a parcel now goes through the shared `Modal` with bordered `fieldInput` fields, a `Select` unit picker and a photo drop zone with preview and remove. The page gained stat tiles (Total / Awaiting collection / Collected), a search card with a clear button, status filter pills with counts, and parcel cards with a status accent bar, photo thumbnail (or gradient icon chip), status pill, meta chips and a Mark collected button. Same endpoints and payloads as before
- [x] **Sidebar scrollbar made visible:** `.sidebar-blue-scroll` in `globals.css` now renders a 9px rounded white thumb at 45% opacity (75% on hover) on a faint track, for both Firefox (`scrollbar-width`/`scrollbar-color`) and WebKit (`::-webkit-scrollbar`), so the nav no longer scrolls invisibly
- [x] Verified: frontend typecheck clean, all four routes return 200, new markup present in the compiled chunks, zero em dashes

---

## 2026-09-16 - Searchable Dropdowns, Audit Trail, Analytics, FAQs, Voting ✅

- [x] **Dropdowns are now type-to-search comboboxes.** `components/ui/Select.tsx` was rebuilt: the trigger is a real text input (focus selects the text so typing replaces it), typing filters the options live with the matched letters highlighted, and the panel shows a "No matches for ..." state. Keyboard support: ArrowUp/ArrowDown to move, Enter to pick (never submits the form), Escape to revert, Tab to close, plus a clear (X) button. Opening over 15 selects across 10 pages needed no call site changes
- [x] **Audit trail rebuilt:** the page was missing its search box entirely (an empty `<div>` sat where the input should be, so searching was impossible from the UI) and had invisible hover states (`hover:text-white` on a light background). Now: `#f6f8fc` canvas, stat tiles (Total records / Actions on this page / Page), a working search input with a clear button plus a 300ms debounce, the action filter, entries grouped under day headings, per-entry entity colouring, actor initials, a changed-fields summary and before/after JSON panels, and proper pagination with a "Showing x-y of n" line
- [x] **Analytics rebuilt:** header with a month-range chip, styled stat tiles, an all-time strip (Invoiced / Collected / recovery bar), a framed chart with gridlines, value tooltips and a real month label (the API returns `2026-09`, which was being printed raw), a sorted category bar list with per-category colours, and vendor cards with a top-vendor trophy
- [x] **FAQ section improved:** live search across questions and answers, topic filter chips with counts, Expand all / Collapse all, an accent bar on the open answer, a topic label per item, a "showing x of y" line and a no-match state. Every FAQ now carries a category, and both pages (admin and resident) got the dashboard canvas plus a "still need help?" card linking to the maintenance board, audit trail or notice board. Two new admin answers (inviting residents, how the platform fee is calculated)
- [x] **Voting (resident polls) rebuilt:** the option rows were unreadable on the light theme - the selected card set `text-white` and the result bars used `bg-white/10`, so both the chosen label and the bars vanished. They are now blue radio cards with a clear selected state, and result bars in accent blue with "Your vote" and winner marks. The amber off-theme palette was dropped, stat tiles and a proper closed-poll list added, and the submit button explains itself when nothing is picked yet
- [x] **Native `required` gap closed:** the custom dropdown cannot trigger browser validation, so the units form now checks the building and the invite form checks the unit for residents, both with a clear inline message
- [x] Verified: frontend typecheck clean, backend typecheck clean, **211/211 backend tests passing** (19 files), all six affected routes return 200, new markup present in the compiled chunks, zero em dashes

---

## 2026-09-16 - Directory / Members Search Fixes + Dashboard Panels ✅

- [x] **Directory search bug fixed.** The search input was rendered only when `entries.length > 0`, and the list was filtered **server-side**, so a query with no matches emptied `entries`, which unmounted the search box and reset every stat tile to 0. You could not clear the search without reloading. The page now fetches the directory once, filters in the browser, always renders the search box (with a clear button), computes the stat tiles from the unfiltered list, and shows a proper "No members matched" state with a Clear search button
- [x] **Residents page (memberships) had no search bar at all.** Added a working search over name, email, unit and role, plus role filter pills (Everyone / Admins / Residents / Guards) with live counts, a Clear button, a "showing X of Y" hint on the section header and a no-match state. Filters are client side, so statistics and the page layout never change while typing
- [x] **Admin dashboard panels rebuilt** (Needs your attention / Recent tickets / Financial & operations / Community activity). New shared `Panel` shell: coloured top rule per panel, gradient icon chip header, hover lift, and a pinned footer. Attention rows now have gradient urgency chips, an urgent/standard rail on hover, a category pill and a circular chevron; ticket rows reuse the tickets-page status colour story with creator/unit/time chips; the Dues panel has its ring, rate, collected, outstanding and a collection progress bar; Maintenance has a clean 2x2 stat grid with a real "No closed tickets" caption instead of a bare dash; the community panels each got their own accent colour, row chips, hover chevrons and illustrated empty states. Captions moved from `gray-700` to `gray-500` so the hierarchy reads properly
- [x] Fixed a mislabel spotted in the Dues panel: the collection cell printed "0 of 0 units" using rupee amounts. It now shows the collection rate with an "of Rs X invoiced" caption
- [x] Attention and tickets panels use `flex-1` inside stretched grid columns, so the empty gap under a short attention list is gone
- [x] Verified: frontend typecheck clean, **211/211 backend tests passing** (19 files), `/dashboard/admin`, `/dashboard/admin/memberships` and `/dashboard/admin/directory` all 200, new markup present in the compiled chunks, zero em dashes

---

## 2026-09-16 - Dashboard Colour Consistency + Poll Readability
- The admin dashboard had drifted into a rainbow: five panel accent colours (blue / purple / amber / emerald / rose), saturated gradient icon chips, per-panel hover tints, emerald amounts, amber count badges and two near-black `bg-gray-900` footer buttons. All of it was decoration, not information
- **One accent now.** `ACCENTS` (keyed by colour) replaced with a single `ACCENT` constant. Every panel top rule, header chip, "View all" link, row hover tint, row icon chip, chevron and empty state is blue. The `accent` prop is gone from `Panel` and `PanelLink`, and the `dark` variant was removed from `PanelButton` (Maintenance's "View all tickets" is now `primary`, matching "Create invoice" on Dues)
- Colour now only appears where it carries meaning: a soft rose icon chip on genuinely urgent attention rows, the emerald "All clear" badge, and the shared `StatusBadge` / `MiniStat` status tints. Work-order counts (`Open` / `In progress` / `Resolved`) use the accent instead of three different hues, and `MiniStat`'s tone type narrowed to `accent | neutral`
- The Dues "Collected" figure was emerald while every other figure was near-black; now `text-gray-900`. Amber "N waiting" parcel badge and the amber "N items" attention badge are accent blue. `PanelEmpty` defaults to a soft accent chip so all five empty states match
- **Polls:** description was `text-body-sm text-gray-500` on white (13px, low contrast). Now `text-body leading-relaxed text-gray-700`, capped at `max-w-2xl`, on both the admin list and the resident voting cards
- **Polls:** voting option cards went from `py-3.5` to `py-4.5` (18px) with a `text-body` label and `text-caption` option description; result rows got `space-y-4.5` and a 3px bar (from 2.5). Admin option rows got `space-y-3.5`, a 2.5px bar and a `text-body` label
- Verified: frontend typecheck clean, `/dashboard/admin`, `/dashboard/admin/polls`, `/dashboard/resident/polls` all 200; the dashboard chunk now contains zero `purple` and only the intentional rose (urgent chip), emerald (all-clear badge + StatusBadge) and amber (StatusBadge warning) strings; `py-4.5` / `space-y-4.5` compile to `1.125rem` in the served stylesheet; zero em dashes

---

## 2026-09-16 - Labelled List Rows + Unit Detail Rebuild
- **New shared primitive** `components/ui/Field.tsx`: `Field` (eyebrow label + value + optional hint) and `FieldRow`. Cards now say what their data is instead of leaving the reader to infer it from an unlabelled chip
- **Units list:** each unit row is now an identity block plus four labelled fields: **Floor**, **Type** (Owner Occupied / Rented / Vacant), **Bedrooms**, **Resident** (falls back to "No resident"). The unit number carries a "Unit" eyebrow plus the status pill; the building sits under it. The icon chip, accent bar and stat tiles were on amber / emerald / purple / blue and now all use the single blue accent, with colour kept only in the status pill
- **Residents list (memberships):** same treatment - "Member" eyebrow, name, email, then labelled **Unit**, **Role**, **Status**, **Member since** fields. The role is the one tinted value (purple admin, amber guard, emerald resident); the row chrome is blue
- **Unit detail page (`units/[id]`) rebuilt** on the dashboard system: `#f6f8fc` canvas, gradient icon header with "Unit" eyebrow + status badge and a building/floor/bedroom sub-line, four stat tiles (Occupancy, Bedrooms, Floor, People), a two-column body with an **Occupant** panel (linked accounts as avatar rows with role colour, unlinked primary contact as a Field grid plus the invite CTA, or an empty state) and a **Unit details** panel (labelled field grid, added/updated dates), and a **Recent tickets** panel with `StatusBadge` and an empty state
- The transfer / move-out flow was kept exactly as it was functionally (same `transfer-check` and `complete-transfer` calls, same gating on `canTransfer`) but now runs through the shared `Modal`, with the decision buttons in the modal footer and dues/members/contact rendered as readable blocks in the body. The old page also still had dark-theme leftovers (`bg-red-500/10`, `text-white` headings) that never rendered correctly on the light dashboard
- Verified: frontend typecheck clean, `/dashboard/admin/units`, `/dashboard/admin/memberships` and `/dashboard/admin/units/[id]` all 200, new markup present in all three compiled chunks, the live `GET /units/:id` and `/transfer-check` payloads match the fields the pages read, zero em dashes

---

## 2026-09-16 - Brand In The Top Bar + Guard Dashboard Rebuild
- **Brand moved out of the sidebar into the top bar** on all three shells (admin, resident, guard). The top bar is now full width (no more `lg:ml-72`) and carries the logo + wordmark on the left, using the landing page treatment (`h-12` logo, `OmniHome` with the `Home` half in `accent-600`), then a hairline divider, then the society name and role. The sidebar starts below the bar on desktop (`lg:top-20 lg:h-[calc(100%-5rem)]`) so the bar owns the full width of the top edge, and the old sidebar `<X>` close button moved into a mobile-only drawer row. Clicking the logo goes to the landing page, as before
- **Guard dashboard (`/dashboard/guard`) rebuilt** across all three views, on the same accent + `#f6f8fc` system as the rest of the dashboard:
  - **Scan QR**: a verify card with a monospace token field (clear button, Enter to submit), a proper failure banner that says *why* a pass cannot be used, and a much stronger visitor card (initials avatar, status badge, labelled Unit / Resident / Phone / Vehicle / Expected / Purpose fields, and full-width 60px **Check in** / **Check out** buttons). Below it, an **On site right now** list read from the live pass list
  - **Packages**: this was broken, not just plain. The unit picker, description input and photo input were **completely unstyled** (no border, no padding, no spacing) which is what made the page look misaligned. The form is now a card with `fieldInput`/`fieldLabel` fields, a photo drop zone with preview and remove, real banners, and a 56px submit button, plus **Waiting** / **Collected today** tiles and a **Waiting for collection** list with photo thumbnails
  - **Recent activity**: was a placeholder card that said "Recent gate activity will appear here" and never fetched anything. It now reads the visitor passes the guard is already authorised to list (`GET /api/v1/visitors`, no new endpoint) and shows four tiles (On site now / Out today / Expected today / Awaiting approval), an **On site now** panel with phone and vehicle, a **Checked out** panel, and an **Expected today** panel with time slots. Gate events use `updatedAt`, which the gate action sets
- The guard shell container widened from `max-w-2xl` to `max-w-3xl` and its canvas moved to `#f6f8fc` so the new cards have contrast
- Verified: frontend typecheck clean, all six dashboard routes 200, guard chunk contains every new heading, the three shell chunks contain the new top-bar brand with **zero** inverted logos left in the sidebars, backend tests **211/211 passing** (19 files), zero em dashes

---

## 2026-09-16 - Loading States + Documents Rebuild
- **New `components/ui/LoadingScreen.tsx`** with three pieces: `LoadingScreen` (a slowly breathing brand mark with a soft halo, a slim indeterminate accent bar and one line of context), `Skeleton` (a shimmering placeholder block) and `PageSkeleton` (heading + tiles + panels sketched out, with a `width` prop so it matches the page it stands in for). Motion is deliberately quiet: `animate-breathe` on the mark, `animate-loading-bar` on the bar, `animate-shimmer` across skeleton blocks. All three keyframes were added to `tailwind.config.js`
- **Route-level loading:** `app/loading.tsx` (root) plus `app/dashboard/admin|resident|guard/loading.tsx`. The dashboard ones sit *inside* each role layout, so the sidebar and top bar stay mounted and only the content area shows the skeleton
- **Shell loaders swapped** from the bare `border-t-transparent` spinner to `LoadingScreen` with real context ("Checking your membership and society data", "Fetching your unit, notices and dues", "Checking your guard access"). The admin dashboard home, units list and residents list now show `PageSkeleton` instead of a full-screen spinner, since their shell is already on screen
- **Documents pages rebuilt** (admin and resident). Both were still on the old white canvas with raw emoji file-type glyphs and duplicated `border border-gray-200` classes, and neither had search. Now: `#f6f8fc` canvas, gradient icon header, stat tiles (Documents / Folders / Size / Latest upload, or Documents / Folders / Size for residents), a folder panel with **live per-folder counts** and active states, a search box with a clear button and a "showing X of Y" line, and document cards with an accent rail, a type icon chip and labelled **Type / Size / Uploaded by / Added** fields
- **Data handling change (no new endpoints):** the list was previously refetched per folder (`?folderId=`), which meant no counts and a spinner on every folder click. Both pages now fetch folders and **all** documents once and filter in the browser, so folder switching and typing are instant and the tiles never move. Upload and delete still hit the same `/documents/upload`, `/documents/:id`, `/documents/folders` endpoints with the same payloads
- Admin upload and "new folder" now run through the shared `Modal` (drop zone with file name and size, optional display name and description); local folder creation refreshes the counts
- Verified: frontend typecheck clean, all dashboard routes 200, `app/dashboard/admin/loading.js` compiled and served, all three keyframes present in the served stylesheet with the `animate-*` utilities generated, backend tests **211/211 passing** (19 files), zero em dashes

---

## 2026-09-16 - Analytics Range Filter + Real Content
- **`GET /api/v1/analytics` is now range-aware**: `?range=1m|6m|1y` (default `6m`), validated with zod, invalid values are a 400. The range scopes the whole report. Bucket granularity adapts so the chart stays readable: one month is **weekly** (four 7-day blocks ending today), six months and a year are **monthly** (6 / 12 buckets), and year labels carry a short year (`Oct 25`, `Sep 26`) because the window crosses a year boundary
- **New metrics** (all range-scoped unless noted):
  - `dues`: invoiced, collected, collection rate, payments received, plus an as-of-now snapshot of outstanding / outstanding count / overdue amount / overdue count
  - `tickets`: raised, closed, open now, avg resolution (hours + days), oldest open ticket age, every-ticket count by status, volume by category, busiest category
  - `vendors`: performance scoped to tickets closed in the window, plus assigned and rated counts
  - `people`: new members, active residents, active guards, visitor passes, visitors on site, pending approvals, parcels logged, parcels waiting
  - `occupancy`: a live snapshot of total / occupied / vacant units, owner-occupied vs rented, and an occupancy rate
- **The response keeps `duesCollection` (six monthly buckets) and `ticketResolution` in their original shape**, because the admin dashboard home reads exactly those two for its Dues and Maintenance tiles. The dashboard home's local interface was trimmed of the two fields it never used (`ticketVolumeByCategory`, `vendorPerformance`)
- **Analytics page rebuilt** with a 1M / 6M / 1Y segmented switcher (refetches `?range=`, dims the content while refreshing rather than blanking it) and the window dates shown next to it. Sections: four range tiles (Collected / Invoiced / Collection rate / Outstanding), the collections trend chart on the adaptive buckets, **Work orders** (raised, closed, open now, avg resolution, oldest-open badge, status chips), **Dues health** (outstanding, overdue, payments received, with a follow-up shortcut), **Tickets by category**, **Vendor performance**, **Occupancy** (rate bar, owner vs rented, vacant) and **Community & gate traffic** (members, visitors, parcels). Old "all time" totals that were actually six-month sums are gone, and the tile palette collapsed onto the single accent plus status red/green
- Verified: backend typecheck clean, **214/214 tests passing** (19 files, 7 analytics tests now covering default range, 1m weekly, 1y monthly, invalid range, empty data, plus the pre-existing 401/403), frontend typecheck clean, analytics page 200, live API checked for all three ranges (weekly windows end today, monthly windows end at month end) and for the `400` on a bad range, zero em dashes

---

## 2026-09-16 - Resident Dashboard Pass (home, notices, polls, documents)
- **Resident shell now owns the canvas**: `<main>` paints `#f6f8fc` and fills the viewport (`min-h-[calc(100vh-5rem)]`), and the `bg-white` wrappers were stripped from the resident pages (amenities, faqs, invoices, parcels, tickets, visitors). Previously half the resident pages were stark white and half were tinted, so moving between them flashed a different ground
- **Resident dashboard home rebuilt** on one panel shell: greeting header with society name and a date card, four stat tiles (Open tickets / Pending dues / Unread notices / Open polls), a *Needs your attention* panel with priority rows (label, why it matters, action pill) plus an "You are all clear" state instead of the panel disappearing, quick-action tiles with count badges, a *Recent activity* panel, and a *Staff on duty* panel with initials avatars and an empty state. The SOS control was restyled as the one deliberately loud element (red top rule, type picker, sent state) with no behaviour change
- **Resident notices page rebuilt**: stat tiles (Notices / Unread / Last 7 days), always-visible search with a clear button, category filter chips with live counts, a "Showing x of y" line, notice cards with a left rail (blue when unread, grey when read), New/Read pills, author, date and read count, and a restyled detail view (accent header band, full meta row, prose body, "More notices" list). Opening a notice still calls `/notices/:id`, which is what records the read receipt
- **Resident polls page polished**: gradient page header, tiles moved onto the single accent (purple/emerald stat chips gone), "Closes in n days" next to the closing date, winner marker changed from an amber trophy to a *Leading* chip and the leading bar from amber to accent, and the *Open for voting* / *You voted* pills moved from emerald to accent. Emerald survives only on the post-vote success banner
- **Resident documents page** was already on this system from the previous pass, so it only needed the canvas fix to line up with the rest
- Verified: frontend typecheck clean, `/dashboard/resident`, `/dashboard/resident/notices`, `/dashboard/resident/polls`, `/dashboard/resident/documents` all 200, compiled chunks contain the new copy ("Needs your attention", "You are all clear", "Staff on duty", "Read notice", "Nothing matched that", "Closes in", "Leading"), off-theme amber/purple/emerald on the three rebuilt resident pages reduced to the intentional success/emergency states, zero em dashes. Backend untouched, so the suite was not re-run

---

## 2026-09-16 - Resident Dashboard Pass 2 (tickets, visitors, amenities, payments, packages)
- **New shared primitives** so the resident dashboard stops re-implementing the same chrome per page:
  - `components/ui/StatTile.tsx` - `StatTile` + `StatTileGrid` (accent top rule, micro-label, figure, hint, icon chip; tone only for things that are actually wrong)
  - `components/ui/Panel.tsx` - `Panel` (rule + icon-chip header + body + pinned footer), `CountPill`, `SectionLabel`, `PanelEmpty`
  - `components/ui/SearchField.tsx` - `SearchField` (always-rendered input, clear button, hint line) and `FilterPills` (counted status pills + Clear)
- **Tickets rebuilt** (`resident/tickets`): tiles (Open / In progress / Resolved / Total), status filter pills with counts, a working search box (the old one had **no className at all**, so it rendered as an unstyled browser input), and status-railed ticket cards. Detail view is now an article with status/category pills, meta row, a **Raise / Working on it / Resolved progress strip**, photo grid, and a Timeline panel with avatar rows plus a comment composer that disables until you type
- **Raise-a-ticket** moved into the shared `Modal` (title, category combobox, description, and a dashed photo dropzone with real **image previews** and per-file remove; same `POST /tickets` then `POST /tickets/:id/photos` flow)
- **Visitor passes rebuilt**: tiles (Active / Awaiting approval / On site / Past), Active passes panel with status rails, meta chips (phone, vehicle, purpose, time), a **Show QR** toggle that reveals the gate QR in a bordered card with the mono token and a **Copy** button, Cancel on pending or approved passes, and a History panel. New pass runs through the shared `Modal`
- **Amenities rebuilt**: tiles (Bookable now / Upcoming / All bookings / Completed), amenity cards with gradient icon chips and the facility rules (max duration, advance notice, per unit per day), and a booking dialog that auto-fills the end time from the facility limit. **Removed `[color-scheme:dark]` from the datetime inputs** - a dark-theme leftover that made the picker unreadable on the light dashboard. My bookings shows status rails, the slot, unit, and Cancel
- **Payments rebuilt** (`resident/invoices`): outstanding summary card with a **Next due** callout and Pay now, tiles (Invoices / Overdue / Paid / Paid total), status filter pills, search with clear, and invoice cards with mono invoice number, due-in / overdue-by pill, labelled Unit / Due date / Billing period fields, amount block, Pay now + Raise a query actions, and an inline query form. All Safepay logic is untouched: `verify-payment` reconciliation, `?success=1` / `?canceled=1` redirect handling, and the retry button. Also added a short "How payments work" panel
- **Packages rebuilt**: tiles (Waiting / Collected / Oldest waiting), Awaiting collection panel with photo thumbnails, waited-since / unit / logged-by fields and Mark collected, plus a Collection history panel. Same `PATCH /parcels/:id`
- **Deduplicated**: the resident home, notices, polls and documents pages now import `StatTile`/`StatTileGrid`/`Panel`/`PanelEmpty` instead of defining their own copies (roughly 150 lines of duplicated markup removed)
- Verified: frontend typecheck clean; all nine resident routes return 200; compiled chunks contain the new copy and none of the old headings ("My Tickets", "Book Amenities", "Invoices & Payments", "Awaiting Collection", "Collection History"); new Tailwind utilities compile (`aspect-square`, `ring-accent-100`, `sm:grid-cols-[auto_1fr]`, `border-dashed`, `text-amber-800`); no `500/10` dark-theme tints or `[color-scheme:dark]` left under `resident/`; zero em dashes. Backend untouched, suite not re-run

---

## 2026-09-17 - Vendor Directory + Manual WhatsApp Hand-off

### Slice: Vendor autocomplete, E.164 phones, and a manual `wa.me` link (ADR 007)

- [x] Prisma: `Vendor` model (societyId, name, phone E.164, email, notes, soft-delete, 3 composite indexes) + `Ticket.vendorId` FK/index - additive migration `20260917000000_add_vendor_entity`
- [x] Shared: `normalizePakistaniPhone()` + `PakistaniMobilePhoneSchema` Zod transform (accepts `0300-1234567`, `+92 300 1234567`, `923001234567`, `0092 300 1234567`, `+92 (0) 300 1234567`; rejects landlines, foreign numbers, letters, too-short input), `phoneDigits()`, `buildWhatsAppLink()`, `CreateVendorSchema`, `VendorResponse`/`VendorSearchResult`/`VendorCreateResult`
- [x] Shared: `UpdateTicketSchema.vendorId`, `TicketResponse` gains `vendorId`, `vendorPhone`, `ticketRef`, `vendorTicketUrl`
- [x] Backend `GET /api/v1/vendors/search?q=` - tenant-scoped, name OR phone match (digits matched both as typed and with the national trunk `0` stripped), capped at 10, `{id,name,phone,email}` only; empty query returns the most recently added vendors
- [x] Backend `POST /api/v1/vendors` - same create path used by the inline "add new vendor" option; idempotent by `(societyId, phone)` (`alreadyExisted: true`), `VENDOR_CREATED` audit entry, phone normalized before it reaches the DB
- [x] Backend `PATCH /tickets/:id` accepts `vendorId`: resolved **tenant-scoped**, snapshot onto `assignedTo`, vendor's on-file email used for the magic link, audit before/after now carries `vendorId`
- [x] Backend: the assignment response returns `vendorTicketUrl` - the exact URL that went into the email - so the admin-facing WhatsApp button reuses one link (never a second token; the raw token is still never stored)
- [x] RBAC: `vendor` resource extended with `create` (SUPER_ADMIN + COMMITTEE_ADMIN = the same roles as `ticket: update`); residents get 403 on search and create
- [x] Frontend: `components/ui/VendorCombobox` - 300 ms debounced search, `Name · phone` rows, "Add \"<typed>\" as new vendor" row when nothing matches, keyboard-driven, styled on the existing `ui/Select` shell
- [x] Frontend: assignment form replaced the free-text vendor name with the combobox + inline new-vendor form (name / mobile / optional email) that creates **and** assigns in one step - the ticket is always assigned by `vendorId`
- [x] Frontend: "Message on WhatsApp" button (ticket detail, after assignment) opens `wa.me/<digits>?text=<encoded ticket ref, title + the emailed magic link>` in a new tab; optional/supplementary, email flow untouched
- [x] Seed script: two demo vendors (E.164 phones) + vendor deleteMany ordered before tickets
- [x] Tests: 248/248 passing (34 new) - phone normalization (14), vendor search/create/detail incl. tenant scoping, RBAC, dedupe (13), ticket vendor assignment incl. cross-society rejection and link reuse (7)
- [x] Live-verified end to end against the Docker stack: messy phone stored as `+923001234567`, duplicate phone reused (`200 alreadyExisted`), national/partial digit queries now hit (bug found and fixed during live testing), resident 403 / anonymous 401, assign by `vendorId` → `vendorLinkSent: true` + `vendorTicketUrl` whose token resolves in the public vendor portal, status-only update keeps the vendor with no new link, `VENDOR_CREATED` + `TICKET_UPDATED` audit rows carry the vendor id

**Notes:**
- Local dev DB is managed with `prisma db push` (no `_prisma_migrations` baseline) - the migration file is for Railway (`prisma migrate deploy`)
- Existing tickets keep their free-text vendor name with `vendorId = NULL` until reassigned through the new form; there was **no** phone column to backfill (the Vendor table is new)
- **ACTION REQUIRED (human):** this slice adds no vendor management screen - editing a vendor's name/phone, merging duplicates, or fixing a typo needs either a follow-up slice or a manual SQL/API call. Logged in ADR 007 rather than silently omitted
- **ACTION REQUIRED (Railway):** run `prisma migrate deploy` for `20260917000000_add_vendor_entity` before the deployment serves the new assignment form
- **Explicitly out of scope (do not build toward):** WhatsApp Cloud API/BSP integration, templates, delivery tracking, any automated/scheduled WhatsApp send

---

## 2026-09-17 - Manual Payment Verification (Screenshot Proof-of-Payment)

### Slice: Resident screenshot proof + admin review queue (ADR 008)

- [x] Prisma: `PaymentProof` model (societyId, invoiceId, residentId, screenshotUrl, claimedAmount, paymentMethod, transactionReference, status, reviewedBy/reviewedAt/rejectionReason, soft-delete, indexes) + `Invoice.paymentSource` (`gateway` | `manual_proof`) + `Payment.paymentProofId` (unique FK) - additive migration `20260917000001_add_payment_proofs`
- [x] Shared: `PaymentMethod` (`BANK_TRANSFER`/`EASYPAISA`/`JAZZCASH`/`CASH_DEPOSIT`/`OTHER`) and `PaymentProofStatus` enums, `SubmitPaymentProofSchema` (positive paisa amount, enum method, optional reference, screenshot required, `rejectionReason` required on reject), `PaymentProofResponse` + `InvoiceResponse.paymentProof`/`paymentSource`
- [x] Backend `POST /api/v1/invoices/:id/payment-proof` - resident-owns-invoice via the existing invoice scoping, multer screenshot upload (image allowlist, 10 MB), rejects `PAID` invoices and a second `PENDING` proof (409), `logAudit()` + `PAYMENT_PROOF_SUBMITTED` notification to the society's active admins
- [x] Backend `GET /api/v1/payment-proofs?status=` - tenant-scoped review queue, cursor-paginated, invoice + resident/unit context inline, `amountMismatch` + both figures per row, `deletedAt: null` filtered
- [x] Backend `POST /api/v1/payment-proofs/:id/approve` - atomic claim from `PENDING`, creates a `Payment` (`provider: manual_proof`) and calls the **existing** `recordSuccessfulPayment()`, so the invoice flips to `PAID` with `paymentSource: manual_proof` and `PAYMENT_CONFIRMED` is audited exactly as a gateway payment; notifies the resident
- [x] Backend `POST /api/v1/payment-proofs/:id/reject` - reason required at the Zod boundary, invoice stays unpaid, resident notified with the reason and can resubmit immediately; reviewing an already-decided proof returns 409
- [x] Backend `GET /api/v1/payment-proofs/:id/screenshot` - serves the image only to admins of that society or the resident who submitted it (unlike parcel/ticket photos, which are served by bare filename)
- [x] RBAC: new `payment_proof` resource (`create` = resident + admin, `read`/`update` = admin only) - approve/reject gated as `update`, matching how SOS acknowledgement and transfer clearance are gated
- [x] Frontend (resident): "Upload payment proof" secondary action on an unpaid invoice, screenshot preview before submit, amount auto-filled from the invoice, method dropdown, optional reference, and a distinct **"Verification pending"** state on the invoice card so the resident knows not to resubmit; a rejected proof shows the reason with a **Resubmit** path back into the same form
- [x] Frontend (admin): `/dashboard/admin/payment-proofs` review queue (status filter defaulting to `Pending`, load-more cursor paging) showing resident, unit, invoice amount, claimed amount **flagged when mismatched**, method, reference, screenshot thumbnail opening full size, and inline Approve / Reject-with-required-reason dialog; sidebar link added
- [x] Frontend (admin): the invoice detail view surfaces the pending/rejected proof state and `paymentSource` so an admin can tell a gateway payment from a verified one
- [x] Tests: 285/285 passing (37 new) - schema/Zod validation (amount, method, reason-required, screenshot), submission guards (paid invoice, duplicate pending), approve flips invoice paid with `source: manual_proof` and fires the payment path, reject leaves the invoice unpaid and permits resubmission, tenant scoping across two societies, RBAC denial for non-admin roles
- [x] Live-verified end to end against the Docker stack: messy-but-valid submissions stored `PENDING`, duplicate pending rejected 409, mismatch surfaced `claimed 1,000 vs invoice 3,000`, admin reject with reason → invoice stayed `ISSUED` with the reason visible to the resident and no `Payment` row created, resubmit allowed, approve → proof `APPROVED` / invoice `PAID` / `paymentSource: manual_proof` / a `Payment` row with `provider: manual_proof`, `status: succeeded`, `paidAt` set, token-scoped screenshot access enforced, cross-society queue isolation, and the dues-reminder sweep excludes both paid invoices (its predicate only selects `ISSUED`/`OVERDUE`). Test proofs/payments were removed after verification and the two test invoices reset to unpaid; audit rows were left in place (append-only)

**Notes:**
- Local dev DB is managed with `prisma db push`; the migration file is for Railway (`prisma migrate deploy`)
- `StorageProvider` still does not exist in the codebase (ADR 002 planned it). Proof screenshots reuse the existing multer disk-upload pattern into `backend/uploads/payment-proofs/`; documented as an implementation note in ADR 008 rather than inventing an abstraction mid-slice
- **ACTION REQUIRED (Railway):** run `prisma migrate deploy` for `20260917000001_add_payment_proofs` before deploying, and make sure the uploads volume persists (`backend/uploads/`) - on Render/Railway this needs a mounted disk, otherwise screenshots vanish on redeploy
- **ACTION REQUIRED (product):** there is no notification that the resident's proof has been *viewed*; the resident only learns the outcome on approve/reject. No SLA/escalation on the review queue either
- **Explicitly out of scope (Phase 10, do not build toward):** OCR/automated screenshot reading, duplicate-screenshot detection, fraud/anomaly scoring, partial-payment logic. The mismatch surfacing in the review response is the hook those would build on
- **Explicitly out of scope:** manual payment methods are **not** added to `PaymentProvider`; this stays a separate subsystem per ADR 008

---

## Slice 16: Cloudinary `StorageProvider` (ADR 002) - signed direct uploads

Replaces the placeholder disk uploads for the two call sites named in ADR 002, and
finally implements the abstraction the ADR asked for in Phase 0/1.

- [x] Backend: `StorageProvider` interface + `CloudinaryStorageProvider` (`lib/storage/`) - the **only** module that imports the `cloudinary` SDK. `getSignedUploadParams` / `confirmUpload` / `getUrl` / `openAssetStream` / `delete`
- [x] Backend: `lib/storage/cloudinary-env.ts` resolves credentials from the three explicit vars (falling back to a valid `CLOUDINARY_URL`) and sanitises a `CLOUDINARY_URL` that was pasted as its own `KEY=value` line, **before** the SDK module is evaluated - the SDK throws at import time otherwise, which would have crashed the backend on boot. Loading is lazy, so an environment with no storage configured answers 503 instead of crashing
- [x] Backend: `POST /api/v1/uploads/signature` - auth + a **per-purpose** permission and ownership check (`ticket-photo` → attach to your own ticket or any ticket you admin; `payment-proof` → your own unit's invoice, admins any). Folder is `omnihome/{societyId}/{resourceType}/{resourceId}` built from the session; a client-supplied `societyId` is ignored and a forged `x-society-id` with no membership is refused 403
- [x] Backend: `POST /api/v1/uploads/confirm` - re-resolves the public id through the provider, which proves the asset exists, lives under the signed folder, matches `allowed_formats` and is within the byte limit (oversized/wrong-type assets are rejected **and** deleted). Audited as `UPLOAD_CONFIRMED`; the endpoint stays generic and does not persist the domain record itself
- [x] Backend: `DELETE /api/v1/uploads/asset` - the only path that permanently removes an asset; admin-only, own-society folder only, audited as `UPLOAD_DELETED`. Soft-deleting a ticket or proof does **not** touch Cloudinary
- [x] Backend: ticket photos rewired to signed uploads - `POST /api/v1/tickets/:id/photos` now takes `{ publicIds }` and re-resolves each one tenant-scoped, storing Cloudinary delivery URLs in `photosUrl`; multer removed from this route. `GET /tickets/photo/:filename` is kept only for photos uploaded before the change
- [x] Backend: payment proofs rewired - `POST /invoices/:id/payment-proof` takes `{ publicId, claimedAmount, paymentMethod, transactionReference }` (multer removed), stores the public id, and `GET /payment-proofs/:id/screenshot` keeps its ADR 008 authorisation but now streams the bytes through the API so the provider URL is never handed to the browser
- [x] Shared: `UPLOAD_PURPOSE_CONFIG` (formats, MIME types, byte limits, resource type) and `storageFolder()` so the signing route, the confirm route, the proof submission and the frontend's pre-flight check cannot drift
- [x] Frontend: shared `useSignedUpload()` hook (sign → upload straight to Cloudinary with **progress** via XHR → confirm) wired into the resident payment-proof form and the ticket photo picker, with upload progress and error states surfaced in both
- [x] Tests: 323/323 passing (38 new) - credential resolution + the pasted-`CLOUDINARY_URL` regression, the pasted-line sanitizer, signature contents (exactly the params the client sends), folder-escape/traversal/wrong-tenant refusal in `confirmUpload`, provider-side format and size re-checks with asset removal, `x-society-id` without membership → 403, resident cannot sign for another resident's ticket or another unit's invoice, unknown purpose → 400, confirm/delete cannot be aimed outside the society's folder, and delete is admin-only
- [x] Live-verified end to end against the real Cloudinary account (36 checks): signature → direct upload → confirm → attach for a ticket photo; a PDF rejected by Cloudinary (400) because `allowed_formats` is signed; foreign-folder and traversal confirms rejected 400; confirm of a non-existent asset → 400; a resident blocked 403 from signing for another ticket/unit and from deleting files; proof submitted from a real upload and readable through the gated screenshot route (`image/png`, 68 bytes) while anonymous got 401 and a resident from another unit got 403; `UPLOAD_CONFIRMED`/`UPLOAD_DELETED` in the audit trail; admin delete really removed the asset from Cloudinary (a follow-up confirm then 400s). Test assets, proofs and payments were removed after verification and the test ticket's `photosUrl` reset; audit rows left in place (append-only)

**Two real bugs found by the live test (both fixed and unit-tested):**
1. The signature covered a `type: 'upload'` param the client never sends, and Cloudinary recomputes the signature over exactly the received params - **every** real upload failed with "Invalid Signature" until it was removed
2. A session with no membership in the requested society returned **500** instead of 403 on the upload routes (no `requireRole`, so nothing guarded the missing membership). Same latent pattern exists in other routes that use `req.membership!.societyId` without a `requireRole` - see ACTION REQUIRED

**Notes:**
- **ACTION REQUIRED (config):** `backend/.env` had `CLOUDINARY_URL` set to the whole pasted `CLOUDINARY_URL=cloudinary://...` line. The Cloudinary SDK throws on that at import time. Corrected in place, and the code now sanitises it defensively
- **ACTION REQUIRED (Railway/Render):** Cloudinary is now the store for new ticket photos and proof screenshots, so the persistent-disk requirement from ADR 008 no longer applies to *new* uploads - but `backend/uploads/` is still used by documents and parcel photos, and by pre-existing ticket photos
- **ACTION REQUIRED (hardening):** `loadMembership` leaves `req.membership` unset when an explicit `x-society-id` has no matching membership, and routes that read `req.membership!.societyId` without `requireRole` answer 500 rather than 403. The upload routes now guard it locally; a middleware-level fix would cover the rest
- **Not migrated (deliberate):** documents (`routes/documents.ts`) and parcel photos (`routes/parcels.ts`) still write to local disk - the interface is ready for them, but they were out of scope for this pass
- **Open question (flagged, not decided):** PDFs are **not** accepted for ticket photos or payment proofs (images only, 10 MB, matching the existing allowlists). The request asked whether PDFs should be allowed for either - left as-is pending a product decision
- **Out of scope, per the request:** OCR/duplicate-screenshot detection, orphaned-asset hard cleanup, and any CDN-invalidation policy

---

### Vendor Contact Flexibility (email OR phone, not both required)

Builds on the vendor entity (ADR 007) and the autocomplete + manual WhatsApp slice. A vendor now needs **at least one** contact channel instead of both, and whichever channel(s) exist are the ones actually used.

**Completed:**
- [x] Shared: one rule, defined once - `VENDOR_CONTACT_ERROR` + `hasVendorContact()`, applied via `.refine()` to both `CreateVendorSchema` and `UpdateVendorSchema` (`phone`/`email` each optional; a blank string counts as absent)
- [x] `hasVendorContact()` tolerates `undefined` - Zod runs object refinements even when a field-level parse already failed, and throwing there turned a clean 400 into a 500
- [x] Prisma: `Vendor.phone` nullable (`email` already was); migration `20260917000002_vendor_optional_contact` also collapses `''` to `NULL` so "no contact" has one representation
- [x] `PATCH /api/v1/vendors/:id` (new) - fills in the missing channel; the at-least-one rule is re-checked against the **merged** record, so clearing the last channel is refused while clearing a redundant one is allowed. `VendorResponse`/`VendorSearchResult` expose `phone: string | null`. Routed through `vendor.update` (`SUPER_ADMIN`/`COMMITTEE_ADMIN`)
- [x] Ticket assignment: emails only when an email exists. No error, no failed job, assignment always succeeds. The magic-link token stays channel-independent, so a phone-only vendor still gets a link - exposed as `vendorTicketUrl` with `vendorLinkSent: false` so "a link exists" and "the vendor was emailed" can never be confused
- [x] Defensive path: a vendor with neither channel is assigned with no link and any stale token hash revoked (unreachable via validation, possible for pre-rule rows)
- [x] Frontend: inline create form accepts either channel, mirrors the rule client-side and states which channel the admin is (not) providing; combobox shows name + whichever contact exists (no more `Name · null`)
- [x] Frontend: assignment confirmation is now three distinct outcomes - green "emailed", amber "no email - send it on WhatsApp below" paired with the button, red "no contact method at all". WhatsApp button only renders when a phone exists
- [x] Tests: 33 new (shared schema rule incl. blank/`undefined` cases, create/update/inline-create at the API, assignment for email-only / phone-only / contactless). **349/349 backend tests pass**, backend + frontend typecheck clean

**Verified live against the Docker stack (24 checks, all pass):** phone-only and email-only vendors create/search/patch correctly; neither-channel rejected with a clear 400; assigning a phone-only vendor returns `vendorLinkSent: false` with a working link (the vendor portal opened from the token in the URL); email-only assignment still reports `vendorLinkSent: true`; clearing both channels in one edit is refused; residents get 403 on create/edit/search.

**Email skip proven, not assumed:** the same assignment was replayed against a second backend instance started with `GMAIL_USER`/`GMAIL_APP_PASSWORD` blanked (so `sendEmail()` logs instead of delivering). Its log contained **exactly one** `[EMAIL] to=` line - for the email-only vendor - and **none** for the phone-only vendor, with both assignments returning 200.

**Migration pre-flight:** no vendor row had neither channel (checked in both `''` and `NULL` forms), so no backfill or manual cleanup was needed. The one pre-existing vendor (`ug`) is phone-only and behaves correctly.

**Notes:**
- **Fixed (was a real 500):** the `.refine()` on the vendor schemas crashed on a malformed create body (Zod runs refinements with `undefined` after a field-level failure). `hasVendorContact()` is now null-safe and the case is pinned by a test
- **ACTION REQUIRED (deploy):** run `prisma migrate deploy` for `20260917000002_vendor_optional_contact` before deploying - it relaxes `Vendor.phone` to nullable
- **ACTION REQUIRED (product):** a phone-only vendor gets **no** automatic notification of any kind (manual WhatsApp is by design). Nothing tracks whether the admin actually sent it, and the job link is only shown right after an assignment. Making that more robust needs a delivery-tracking design (Phase 10), not a bigger prompt here
- **Follow-up, not built:** there is still no vendor edit screen in the UI. `PATCH /api/v1/vendors/:id` exists and is tested, but the only form is the inline create on the assignment panel

---

## Notes for Next Session
- **Phase 10 (AI Layer)** is next: Python + FastAPI service, pgvector, semantic search, AI features
- Backend runs inside Docker at `http://localhost:4000`, frontend at `http://localhost:3000`
- Seeded test creds: `admin@sunrise.com` / `admin123`, `resident@sunrise.com` / `resident123`
- Auth uses HTTP-only cookies - `credentials: 'include'` on all fetch calls
- Documents stored locally in `backend/uploads/` - Cloudinary integration still deferred
- `multer` and `@types/multer` installed in backend
- `qrcode.react` installed in frontend for QR code rendering
- Safepay webhook endpoint live at `/api/v1/payments/webhook` - register it in the Safepay dashboard and add `SAFEPAY_WEBHOOK_SECRET` to Railway env
- Payments fall back to offline mode only when Safepay keys are absent
- Fixed: Invite endpoint now returns `tempPassword` so admin can share with invited residents
- `ioredis` in package.json but not wired up (token blacklisting deferred)
- BullMQ wired for automated dues reminders (Slice 2) - needs `REDIS_URL` on Railway
- Vendor directory (ADR 007): `npm run db:seed` creates two demo vendors; local DB needs `npx prisma db push` (inside the backend container) to get the `Vendor` table because this DB has no migration baseline
- Vendors now need **at least one** of email/phone, not both (ADR 007 implementation notes). A phone-only vendor is assigned normally but nothing is emailed - the admin sends the job link with the "Message on WhatsApp" button, and the assignment confirmation says so in amber rather than claiming an email went out
- Manual payment proofs (ADR 008): `npm run db:seed` creates one unpaid demo invoice (`INV-DEMO-0001`, Rs 2,500) for exercising the upload/review flow; screenshots now go to Cloudinary (ADR 002), not `backend/uploads/payment-proofs/`
- Cloudinary (ADR 002) is live: new ticket photos and proof screenshots upload straight from the browser to `omnihome/{societyId}/...` using server-signed params (`POST /api/v1/uploads/signature` → Cloudinary → `POST /api/v1/uploads/confirm`). Requires `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET` (or a valid `CLOUDINARY_URL`) - without them the upload routes answer 503, everything else still boots
- `npm install` on the host installs `cloudinary` (hoisted to the root `node_modules`); the Docker backend picks it up from `package.json` on container start. If you change backend code while testing by hand, `docker compose restart backend` - the file watcher does not reliably see edits across the Windows bind mount
