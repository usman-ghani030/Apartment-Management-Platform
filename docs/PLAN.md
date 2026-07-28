# Apartment Management Platform — Master Plan

> **Purpose of this document:** This is the single source of truth for architecture, conventions, and phase scope. AI coding agents (Claude Code, opencode, etc.) and the human developer should read this before starting any task. If a decision here needs to change, update this file first, then write code — never let code and this doc drift apart.

---

## 1. Product Summary

A multi-tenant SaaS platform that replaces WhatsApp, paper logs, and spreadsheets for residential community (apartment/society) management. Each customer ("Society") gets an isolated workspace covering communication, maintenance, payments, bookings, security/visitor management, and governance (voting), with an AI layer added after core workflows are stable.

**Business model context:** Multi-tenant SaaS from day one. Many independent societies will sign up; each society's data must be fully isolated from every other society's data, enforced structurally (not by convention).

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend API | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM + pgvector extension (added in Phase 7) |
| Cache | Redis |
| File Storage | Cloudinary or AWS S3 (decide at Phase 0, see open questions) |
| AI Service | Python + FastAPI (separate service, added Phase 7+) |
| AI SDK | Vercel AI SDK / OpenAI Agents SDK |
| Payments | Stripe |
| Deployment (later, NOT now) | Vercel (frontend) + Railway (backend) for MVP, migrate to AWS later |

**Do not set up deployment infrastructure until explicitly instructed.** Development happens locally / in dev environments until the whole phased build is complete.

---

## 3. Project Structure — npm Workspaces (not a full monorepo tool)

Package manager: **npm**, using npm's built-in **workspaces** feature — no Turborepo, no separate build orchestration tool. Simple, sufficient for a two-package solo project, and one `npm install` at the root installs everything.

```
/frontend          → Next.js app (TypeScript + Tailwind)
/backend           → Express + TypeScript API, Prisma schema/client lives here (backend/prisma/)
/shared            → Shared TypeScript types/interfaces/Zod schemas (DTOs, enums), imported by both frontend and backend
/docs
  PLAN.md           → this file
  AGENTS.md         → AI agent operating manual
  PROGRESS.md       → running build log
  /adr              → Architecture Decision Records
package.json        → root, declares npm workspaces: ["frontend", "backend", "shared"]
```

Rules:
- Domain types (e.g. `Society`, `Ticket`, `Role`) live in `shared`, derived from Prisma types where possible, and imported by both `frontend` and `backend` via the workspace reference (`"shared": "*"` in each package's dependencies). Never redefine the same shape twice.
- Prisma schema, migrations, and generated client live in `backend/prisma` — no separate `db` package. `shared` imports Prisma-derived types from `backend` only where needed (e.g. via a types-only export), never the Prisma client itself (frontend must never get direct DB access).
- No feature code in `backend/prisma` beyond schema, migrations, and a typed Prisma client export.
- `ai-service` (Python + FastAPI) is added as its own top-level folder only when Phase 7 starts — it's a separate language/runtime, so it sits outside the npm workspace, not inside it.

---

## 4. Core Architectural Principles (non-negotiable)

These apply to every phase and every feature, regardless of which agent or session writes the code.

### 4.1 Multi-tenancy: shared DB, shared schema, `societyId` scoping
- Every tenant-scoped table has a `societyId` foreign key column.
- All reads/writes MUST be scoped to the authenticated session's `societyId`. This is enforced via a Prisma middleware / repository layer (see `backend/src/db/tenant-scope.ts`, built in Phase 0) — **never rely on individual query authors remembering to add the filter.**
- Global (non-tenant) tables: `User` (a person can theoretically belong to multiple societies via `Membership`), platform-level `SuperAdmin` accounts.
- Cross-tenant data access is a critical bug, not a feature request. Any code that queries without going through the tenant-scoped repository layer should be treated as a red flag in review.

### 4.2 Schema-first development
- The Prisma schema is the source of truth for the domain model. Changes to core entities (Society, Building, Unit, User, Membership, Role) require updating `backend/prisma/schema.prisma` and a migration, then regenerating shared types — before any UI or API code is written against them.
- Do not invent ad-hoc fields on the fly inside a route handler. Update the schema first.

### 4.3 Vertical slices
- Features are built end-to-end (DB → API → UI) one at a time, not layer-by-layer across all features. Each phase below is broken into slices; complete and test one slice before starting the next.

### 4.4 Audit trail is infrastructure, not a feature
- A generic `AuditLog` table is built in Phase 0: `id, societyId, actorUserId, action, entityType, entityId, beforeJson, afterJson, createdAt`.
- Every mutating action in every module (create/update/delete ticket, payment, vote, booking, membership change, etc.) writes an entry. Build a small helper (`logAudit(...)`) in Phase 0 and use it everywhere — do not build per-feature audit logging later.

### 4.5 Type safety & validation boundaries
- TypeScript strict mode everywhere.
- All API request/response bodies validated with Zod at the Express route boundary before touching business logic.
- Since this is a solo-developer + AI-agent workflow, type safety and validation are the primary review mechanism — treat `any` and unvalidated `req.body` access as bugs.

### 4.6 Small, reviewable units of work
- One vertical slice = one feature branch = one focused set of commits. Avoid multi-feature mega-commits; they are hard for a human reviewer to check when an agent wrote the code.

---

## 5. Redis Usage (defined now so it isn't reinvented per-feature)

Redis is in the stack from Phase 0 but used minimally at first, expanding as phases need it:

- **Phase 0**: session/token blacklist (logout, revoked memberships) and simple rate limiting on auth routes.
- **Phase 1+**: background job queue via BullMQ — used for anything that shouldn't block a request: notification dispatch (email on new notice/ticket status), recurring invoice generation (Phase 2), booking-conflict cleanup jobs (Phase 3).
- **Do not** use Redis as a source of truth for anything — it's always a cache/queue in front of Postgres, never the only copy of data.
- One `backend/src/queue/` module owns all BullMQ queue definitions; features add jobs to it rather than creating ad-hoc queues.

## 6. API Conventions

Applies to every Express route from Phase 0 onward — agents should follow these without re-deciding per feature.

- **Response envelope**: `{ data, error: null }` on success, `{ data: null, error: { code, message } }` on failure. No bare arrays/objects returned from routes.
- **Pagination**: cursor-based (`?cursor=&limit=`) for list endpoints, default `limit=20`, max `100`. Return `{ data: [...], nextCursor }`.
- **Versioning**: prefix all routes `/api/v1/...` from day one — costs nothing now, avoids a painful rename later.
- **Errors**: thrown as a typed `AppError(code, httpStatus, message)` caught by a single Express error-handling middleware — no inline `res.status(500).json(...)` scattered through route handlers.
- **Dates**: store and transmit all timestamps as UTC ISO-8601. Convert to society's local timezone only at the display layer (frontend), never in the DB or API. `Society` gets a `timezone` field in Phase 0 for this reason.
- **IDs**: use UUIDs (Prisma `@default(uuid())`), not auto-increment integers — avoids leaking record counts across tenants and is safer for a public-facing API later.

## 7. Data Lifecycle: Soft Delete

- Tenant-scoped entities that matter for audit/history (`Unit`, `Membership`, `Ticket`, `Booking`, `Notice`, etc.) use a `deletedAt DateTime?` column — never hard-delete. The tenant-scope repository layer filters `deletedAt: null` by default.
- Hard deletes are reserved for genuinely disposable data only (e.g. expired sessions), never for anything that could appear in the `AuditLog` or a financial record.
- This matters specifically because Section 4.4's audit trail is meaningless if the underlying rows can vanish.

## 8. Local Development Setup (Phase 0 deliverable)

- `docker-compose.yml` at repo root running Postgres + Redis for local dev.
- `.env.example` in `backend/` and `frontend/` listing every required variable (DB URL, Redis URL, JWT secret, Stripe keys placeholder, storage provider keys) — kept in sync as phases add new env vars. No feature ships without updating this file.
- Root `package.json` scripts (run from repo root via npm workspaces, e.g. `npm run dev --workspace=backend`) plus convenience root scripts:
  - `npm run dev` — runs frontend + backend concurrently (e.g. via `concurrently` or `npm-run-all`)
  - `npm run db:migrate` — runs Prisma migration (delegates to `backend`)
  - `npm run db:seed` — seeds one demo Society + admin + a few units for local testing (delegates to `backend`)
  - `npm run lint` / `npm run test` — run across all workspaces
- Single `npm install` at the repo root installs dependencies for `frontend`, `backend`, and `shared` together.

## 9. Indexing Baseline

- Every table with a `societyId` column gets a composite index starting with `societyId` (e.g. `@@index([societyId, createdAt])` on high-traffic tables like `Ticket`, `AuditLog`) — since virtually every query filters by tenant first. Add this at the same time a table is created, not as a later performance pass.

## 10. Core Domain Model

This is the backbone. It's built in Phase 0 and extended (not restructured) in later phases.

```
Society (tenant)
  id, name, subdomain/slug, createdAt, subscriptionPlan (later), ...

Building
  id, societyId, name

Unit
  id, societyId, buildingId, unitNumber, floor, type (owner-occupied/rented/vacant)

User
  id, email, name, passwordHash (or external auth id), createdAt
  — global identity, NOT tenant-scoped directly

Membership
  id, userId, societyId, unitId (nullable — admins may not have a unit), role, status (active/revoked), createdAt
  — this is the join table that gives a User a Role within a specific Society, optionally tied to a Unit

Role (enum, extend carefully): SUPER_ADMIN | COMMITTEE_ADMIN | RESIDENT | SECURITY_GUARD | VENDOR

AuditLog
  id, societyId, actorUserId, action, entityType, entityId, beforeJson, afterJson, createdAt
```

**Key relationship rule:** A `User` can have multiple `Membership` rows (multiple societies, or multiple units within one society — e.g. owns 2 flats). All permission checks go through `Membership`, never assume a user has exactly one role.

Later phases add entities that hang off this backbone (Ticket, Vendor, Payment, Booking, VisitorPass, Notice, Vote, Document) — each references `societyId` and usually `unitId` and/or `userId`.

---

## 11. Roles & Permissions (MVP baseline)

| Role | Scope | Notes |
|---|---|---|
| SUPER_ADMIN | Platform-wide | Anthropic-internal use / your own ops account, not sold to customers |
| COMMITTEE_ADMIN | One Society | Manages units, residents, notices, tickets, approves vendors, sees all financials |
| RESIDENT | One or more Units within a Society | Raises tickets, views notices, votes, books amenities, pays dues |
| SECURITY_GUARD | One Society | Deferred to Phase 4 — visitor approval, gate logs |
| VENDOR | Scoped to assigned tickets | Deferred — later phase, may not need full account in MVP |

Permission checks are role + society + (sometimes) unit scoped. Build a single `can(user, action, resource)` authorization helper in Phase 0 rather than scattering `if (role === 'X')` checks through route handlers.

---

## 12. Phased Build Plan

**Rule for every phase:** no deployment work, no premature optimization, no building ahead into a later phase's entities. Finish and manually test a phase's vertical slices before moving on.

### Phase 0 — Foundation (no user-facing "features" yet, but everything depends on this)

- [ ] npm workspaces scaffold: root `package.json` + `frontend`, `backend` (with `backend/prisma`), `shared`
- [ ] Prisma schema: `Society`, `Building`, `Unit`, `User`, `Membership`, `AuditLog`
- [ ] Postgres running locally (Docker recommended), initial migration
- [ ] Tenant-scoping middleware/repository pattern in `backend/prisma`
- [ ] `logAudit()` helper
- [ ] `can(user, action, resource)` authorization helper
- [ ] Auth: signup flow that creates a `Society` + first `COMMITTEE_ADMIN` `User` + `Membership` in one transaction (this is tenant onboarding — the entry point for every new customer)
- [ ] Login/session (JWT or session-based — decide and document as ADR)
- [ ] Resident invite flow: admin invites a person by email → creates `User` (if new) + `Membership` scoped to a `Unit`
- [ ] Basic RBAC middleware on Express routes using the `can()` helper
- [ ] Minimal Next.js shell: login, signup, admin dashboard stub, resident dashboard stub

**Exit criteria:** A committee admin can sign up, create buildings/units, invite a resident, and the resident can log in and see an empty dashboard — with all data provably scoped to their `societyId`.

### Phase 1 — Core MVP (highest daily-use value)

- [ ] **Notices/Announcements**: admin creates/publishes notices, residents see a feed, read receipts optional
- [ ] **Resident Directory**: list of residents per unit/building, searchable, admin-editable
- [ ] **Maintenance Ticketing**: resident creates ticket (category, description, photos via storage), status lifecycle (Open → Assigned → In Progress → Resolved → Closed), admin assigns to a vendor placeholder (full vendor accounts deferred), timeline/comments per ticket
- [ ] Push/email notification stub for new notices and ticket status changes (real push infra can be simple at this stage — e.g. email via a transactional provider; defer native push)

**Exit criteria:** A resident can raise a maintenance ticket and see it move through statuses; admin can post a notice residents actually see. This is the first demo-able "WhatsApp replacement" moment.

### Phase 2 — Money

- [ ] Dues/invoice generation per unit (manual or recurring rule-based)
- [ ] Stripe integration: online payment collection
- [ ] Webhook handling + reconciliation (payment → invoice status update)
- [ ] Payment history per unit, visible to resident and admin
- [ ] Basic dispute/flag mechanism (resident flags a charge, admin resolves)

### Phase 3 — Bookings

- [ ] Amenity entity (clubhouse, gym, pool, etc.) per society
- [ ] Visual calendar UI, conflict prevention at booking-creation time
- [ ] Booking rules (max duration, advance notice, per-unit limits — configurable per society)
- [ ] Admin override/cancel

### Phase 4 — Security & Visitor Management

- [ ] VisitorPass entity: resident pre-approves a visitor, generates QR code
- [ ] Guard-facing minimal interface (kiosk/tablet friendly — separate lightweight route or app, decide as ADR when this phase starts)
- [ ] Gate log (entry/exit timestamps tied to VisitorPass)
- [ ] Auto-revoke access when a `Membership` is marked inactive/moved-out

### Phase 5 — Governance

- [ ] Poll/Vote entity tied to a Notice or standalone
- [ ] One-vote-per-unit enforcement (not per user — important, since a unit can have multiple residents)
- [ ] Results visibility rules (live vs after-close, configurable)

### Phase 6 — Documents & Enhanced Audit

- [ ] Document storage (society bylaws, meeting minutes, vendor contracts) via Cloudinary/S3
- [ ] Folder/category structure per society
- [ ] Audit trail UI (searchable/filterable view over `AuditLog`, built on infra from Phase 0)
- [ ] Committee transition flow (export/handover of records)

### Phase 7 — AI Layer

- [ ] Stand up `ai-service` (Python + FastAPI)
- [ ] pgvector enabled on relevant tables (e.g. tickets, documents) for semantic search
- [ ] Vendor auto-assignment suggestions based on ticket category/history
- [ ] Anomaly detection on payments/maintenance costs (flag overcharging patterns)
- [ ] Natural-language query over documents/notices (RAG)
- [ ] Only build AI features here — do not let AI dependencies leak into earlier phases

---

## 13. Explicit Non-Goals for Now

- No deployment/infra setup (Vercel/Railway/AWS) until all phases above are functionally complete and explicitly requested.
- No native mobile app — web-responsive only, PWA consideration deferred.
- No vendor self-service portal in MVP (vendors are referenced by name/contact until Phase 4+ decides otherwise).
- No premature multi-region / horizontal scaling work — single-region Postgres is fine until there's real load.

---

## 14. Conventions for AI Agents Working on This Codebase

- Read this file and the relevant `docs/adr/*.md` before starting a task.
- Before modifying the Prisma schema, check if the change belongs in the current phase — don't add later-phase entities early "while you're in there."
- Every new mutating API route: validate input with Zod → check `can()` → perform tenant-scoped DB operation → `logAudit()` → return typed response.
- Naming: `camelCase` for TS variables/functions, `PascalCase` for types/components/Prisma models, table names singular in Prisma schema (`Unit`, not `Units`).
- One feature = one vertical slice = one branch. Don't mix unrelated features in one PR/commit set.
- If a task requires an architectural decision not covered here (e.g. JWT vs session auth, Cloudinary vs S3), write a short ADR in `docs/adr/` explaining the choice and rationale before implementing, then update this file's relevant section if it affects future phases.
- Flag (don't silently resolve) any ambiguity about tenant scoping — it's the one category of bug that's unacceptable in this system.

---

## 15. Open Questions (resolve before or during Phase 0)

- [x] **Storage: Cloudinary**, decided for MVP (easier setup, built-in image transforms for ticket photos, generous free tier). See `docs/adr/002-storage-provider.md`. **Requirement**: implement behind a `backend/prisma`-adjacent `StorageProvider` interface (`upload`, `getUrl`, `delete`) in Phase 0/1 — no feature calls the Cloudinary SDK directly — so migrating to S3 later per the AWS deployment plan is a contained swap, not a rewrite.
- [x] **Auth: custom JWT (access + refresh) in Express**, decided for MVP. See `docs/adr/001-auth-mechanism.md`. Argon2 for password hashing, refresh tokens stored in Redis (revocable — required for auto-revoking moved-out residents), access token payload carries only `userId` (never role/societyId, since those must reflect live `Membership` state, not a stale token).
- [ ] Notification delivery for Phase 1: email provider choice (Resend/Postmark/SES) for the notice/ticket-status notifications.

---

## 16. Change Log

| Date | Change |
|---|---|
| 2026-07-19 | Initial plan created |
| 2026-07-19 | Added Redis usage, API conventions, soft-delete policy, local dev setup, and indexing baseline (self-review pass) |
| 2026-07-19 | Resolved auth (custom JWT) and storage (Cloudinary) decisions; added ADR 001 and 002 |
| 2026-07-19 | Simplified project structure: dropped Turborepo for plain npm workspaces (`frontend`, `backend`, `shared`) instead of `apps/`+`packages/` layout |