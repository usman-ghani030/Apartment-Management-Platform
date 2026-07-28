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
- Stripe webhook endpoint still missing — payments work in offline mode
- Fixed: Invite endpoint now returns `tempPassword` so admin can share with invited residents
- `ioredis` in package.json but not wired up (token blacklisting deferred)
