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

## Notes for Next Session
- **Phase 7 (AI Layer)** is next: Python + FastAPI service, pgvector, semantic search, AI features
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
