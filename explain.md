# OmniHome — Project Explained

A multi-tenant **society / apartment-community management platform** built for Pakistani housing societies. One deployable app serves many societies; each society is an isolated tenant with its own buildings, units, residents, guards, dues, visitors and records.

Everything a committee currently runs on WhatsApp groups, paper registers and spreadsheets is in one product: dues and payments, maintenance tickets, gate/visitor control, amenity bookings, notices, polls, documents, packages, staff, SOS alerts and an audit trail.

---

## 1. Quick facts

|                           |                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Product name**    | OmniHome                                                                                                                           |
| **Repo**            | npm**workspaces** monorepo (not Turborepo/Nx): `frontend`, `backend`, `shared`                                         |
| **Frontend**        | Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS,`lucide-react` icons, `qrcode.react`                            |
| **Backend**         | Express 4 + TypeScript, Prisma 5 → PostgreSQL, Zod validation, BullMQ + Redis for jobs                                            |
| **Shared**          | `@apartment/shared` — 200+ Zod schemas / types / constants, the single source of truth for both ends                            |
| **Data model**      | 29 Prisma models, 20 migrations                                                                                                    |
| **API**             | ~130 REST handlers across 24 route modules under`/api/v1/*`                                                                      |
| **Auth**            | JWT access (15 min) + refresh (7 days), httpOnly cookies*and* `x-access-token` header; Google Sign-In; password reset by email |
| **Roles**           | `SUPER_ADMIN`, `COMMITTEE_ADMIN`, `RESIDENT`, `SECURITY_GUARD`, `VENDOR`                                                 |
| **Tests**           | 29 backend test files,**371 tests** (Vitest + Supertest). Frontend has typecheck only, no test runner                        |
| **Payments**        | Safepay hosted checkout (+webhook), plus offline manual payment proofs; separate platform-subscription billing                     |
| **Storage / Email** | Cloudinary (signed direct uploads) / Nodemailer over Gmail SMTP                                                                    |
| **Deploy**          | Frontend → Vercel (`vercel.json`), Backend → Railway via `Dockerfile` (`railway.json`)                                     |

---

## 2. Repository layout

```
apartment-management/
├── backend/                 Express API (also the job runner)
│   ├── prisma/              schema.prisma (29 models), 20 migrations, seed.ts
│   └── src/
│       ├── app.ts           Express app: all route mounts, health check
│       ├── index.ts         boot + start/stop BullMQ queues + graceful shutdown
│       ├── routes/          24 modules (auth, units, invoices, visitors, …)
│       ├── lib/             domain logic: auth, email, audit, payments, storage,
│       │                    permissions, notifications, csv-parse, recurring-billing,
│       │                    platform-billing, due-reminders
│       ├── middleware/      requireAuth, loadMembership, requireRole, errorHandler
│       ├── config/          platform-pricing.ts (rate table = config, not code)
│       ├── db/              tenant-scope.ts (societyId-scoped query wrappers)
│       └── queue/           BullMQ queues + schedulers
├── frontend/                Next.js app
│   └── src/
│       ├── app/             landing, login/signup/forgot/reset, dashboard/*, vendor/ticket/[token]
│       ├── components/      ui/ kit (Modal, Panel, Field, Select, StatTile…), dashboard/
│       │                    shells (admin/resident/guard), feature-visuals, faq-section
│       └── lib/             api.ts (fetch + token refresh), theme.tsx, useSignedUpload.ts
├── shared/src/index.ts      Zod schemas + inferred types + constants (CSV headers, upload purposes…)
├── docs/                    PLAN, PROGRESS, MASTER_PROJECT_INTELLIGENCE, 8 ADRs, manual test guides
├── docker-compose.yml       postgres + redis + backend for local dev
├── Dockerfile               backend production image (Railway)
└── tools/deck                presentation tooling
```

---

## 3. Architecture

```
Browser (Next.js)
  │  fetch  /api/v1/*   +  x-access-token header  (cookies also set)
  ▼
Express API ──► middleware: requireAuth → loadMembership → requireRole(action, resource)
  │
  ├─► Zod schema validation  (from @apartment/shared)
  ├─► Prisma (societyId-scoped, soft delete)  ──► PostgreSQL
  ├─► BullMQ + Redis workers (cron jobs)      ──► same Postgres
  ├─► Cloudinary (signed uploads, browser → Cloudinary directly)
  ├─► Safepay (hosted checkout + webhook)
  └─► Nodemailer/Gmail (reset links, vendor magic links, reminders)
```

**Non-negotiable principles** (from `docs/PLAN.md`):

1. **Multi-tenancy** — one database, one schema, every row scoped by `societyId`. `db/tenant-scope.ts` wraps Prisma calls so a query cannot forget the filter.
2. **Schema-first** — request/response shapes are Zod schemas in `shared`; the backend validates on the way in, the frontend mirrors it only for UX (server is the source of truth).
3. **Audit trail is infrastructure** — `lib/audit.ts` writes `AuditLog` rows for mutations; the admin "Audit trail" page and CSV export read them.
4. **Soft delete** — models carry `deletedAt`; reads exclude deleted rows by default.
5. **Vertical slices** — features are built end-to-end (schema → route → UI → tests) per phase.
6. **Provider abstractions** — email, storage and payments sit behind small interfaces so swapping vendors is contained (see ADRs).

---

## 4. Domain model

| Group            | Models                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Tenancy & people | `Society`, `Building`, `Unit`, `User`, `Membership` (user↔society+role), `Staff`, `Vendor` |
| Money (resident) | `Invoice`, `Payment`, `PaymentProof`, `InvoiceReminder`                                           |
| Money (platform) | `PlatformInvoice`, `PlatformCustomQuoteFlag`                                                          |
| Community        | `Notice`, `NoticeReadReceipt`, `Poll`, `Vote`, `DocumentFolder`, `Document`                   |
| Operations       | `Ticket`, `TicketComment`, `Amenity`, `Booking`, `Parcel`, `SOSAlert`                         |
| Gate             | `VisitorPass`, `GateLog`                                                                              |
| Platform         | `AuditLog`, `PasswordResetToken`                                                                      |

Notable fields: `Unit` carries `bedroomType`, `type` (`OWNER_OCCUPIED`/`RENTED`/`VACANT`) and primary-contact details; `User` supports both a password hash and a Google ID; `Ticket` supports vendor assignment, ratings and `closedAt`.

---

## 5. Roles & permissions

Authorization is a static matrix in `backend/src/lib/permissions.ts`: **resource → action → allowed roles**, e.g.

```ts
unit:  { create: ['SUPER_ADMIN','COMMITTEE_ADMIN'],
         read:   ['SUPER_ADMIN','COMMITTEE_ADMIN','RESIDENT'], … }
```

Resources covered: `society, building, unit, membership, user, notice, ticket, invoice, amenity, booking, visitor, poll, document, parcel, vendor, analytics, staff`.

| Role                      | What they get                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **SUPER_ADMIN**     | Platform operator — everything, including society/platform billing oversight                                                                  |
| **COMMITTEE_ADMIN** | The society committee: buildings, units, residents, money, tickets, notices, polls, documents, staff, audit trail                              |
| **RESIDENT**        | Own unit: dues + pay online / upload payment proof, raise tickets, book amenities, create visitor passes, vote, read notices, collect packages |
| **SECURITY_GUARD**  | Purpose-built gate view only: scan/verify visitor QR passes, log parcels, recent gate activity                                                 |
| **VENDOR**          | No login — token-secured magic link to view/update one assigned ticket                                                                        |

Route protection chain: `requireAuth` (JWT → `req.user`) → `loadMembership` (active membership → `req.membership`, `x-society-id` header for multi-society users) → `requireRole(action, resource)`.

---

## 6. Feature set

**Admin dashboard** (23 pages): home dashboard, buildings, units (+unit detail), residents/memberships, directory (+resident detail), maintenance tickets, staff, amenities + bookings, SOS alerts, notices, visitors, security-gate link, invoices, payment proofs review queue, platform billing, polls, documents, packages, analytics, audit trail, FAQs.

**Resident dashboard** (10 pages): home, invoices/payments, tickets, visitors, amenities, packages, polls, notices, documents, FAQs.

**Guard dashboard**: one catch-all route with four views — scan, parcels, recent activity, FAQs.

**Vendor portal**: `/vendor/ticket/<token>` — no account, no login; view the job and update status.

**Public**: marketing landing page (`app/page.tsx`) with hero rotator, four feature showcases, built-in-tools grid, testimonials, pricing, FAQ and CTA; signup (creates society + admin), login, forgot/reset password, Google Sign-In.

**Cross-cutting**: light/dark theme (dark default), dashboard shells with grouped navigation, notification fan-out (`lib/notifications.ts` — a typed union of 14 events, written to the audit trail and emailed where relevant), bulk CSV import for buildings and units (two-step validate → confirm).

---

## 7. Money: two separate systems

Never merged — different payer, payee and entity.

1. **Resident dues** (`Invoice` / `Payment`)
   - Generated manually or by the monthly recurring-billing job.
   - **Online**: Safepay hosted checkout; `POST /api/v1/payments/webhook` verifies the Safepay signature over the raw body and marks the invoice paid.
   - **Offline** (ADR 008): resident uploads a payment screenshot → lands in the admin *Payment proofs* review queue → approve marks paid, reject requires a reason. Residents without Safepay keys configured can still settle dues.
   - `InvoiceReminder` guarantees a reminder fires once per (invoice, dueDate).
2. **Platform billing** (`PlatformInvoice`, ADR 006)
   - The *society* pays *OmniHome*. Pricing is **progressive** (like income tax), defined in `config/platform-pricing.ts`: free up to 15 units, then bands at Rs 20 / 12 / 8 per unit-month; above 500 units it raises a custom-quote flag instead of auto-invoicing. Changing prices is a config edit.
   - Billing period `YYYY-MM`, due on the 15th of the following month; separate overdue-check job; admin UI at `/dashboard/admin/platform-billing`.

---

## 8. Background jobs

All in `src/queue/index.ts` (BullMQ + Redis), started from `index.ts` and shut down gracefully:

| Job               | Default cron  | Does                                                                                    |
| ----------------- | ------------- | --------------------------------------------------------------------------------------- |
| Due reminders     | `0 9 * * *` | Finds unpaid invoices inside each society's reminder window, fires`DUE_REMINDER` once |
| Recurring billing | `0 8 1 * *` | Generates monthly resident invoices                                                     |
| Platform billing  | `0 8 1 * *` | Generates society subscription invoices                                                 |
| Platform overdue  | `0 9 * * *` | Marks overdue platform invoices                                                         |

**Resilience:** if `REDIS_URL` is missing or Redis is down, the queue starts in a disabled mode — the API keeps serving, jobs simply don't run, and admins can still trigger reminders manually. Crons are overridable by env (`DUE_REMINDER_CRON`, etc.).

---

## 9. API conventions

- Base path `/api/v1`, one router module per resource, mounted in `app.ts`.
- Envelope: `{ "data": …, "error": null }` on success, `{ "data": null, "error": { "code", "message" } }` on failure (`AppError` + `ErrorCodes` + central `errorHandler`).
- Pagination on list endpoints (`?page=&perPage=`); filters via query params.
- Validation: Zod `safeParse` → 400 with a field-level message. `errorHandler` recognises Zod errors structurally (`err.name === 'ZodError'`) so a duplicated zod instance (CJS+ESM) can't silently degrade messages.
- Health check: `GET /api/v1/ping` → `{ data: { message: 'pong' }, error: null }`.

---

## 10. Authentication in detail

- **Passwords**: bcryptjs hashes; signup creates the society *and* its committee admin in one transaction.
- **Tokens**: short-lived access JWT + long-lived refresh JWT. Both are set as httpOnly cookies **and** returned in the body, because the frontend is cross-origin (Vercel ↔ Railway) and also sends `x-access-token`. The frontend keeps tokens in `localStorage` and refreshes with a **single-flight** promise so parallel 401s trigger only one refresh.
- **Google Sign-In**: Google Identity Services button → ID token → verified server-side with `google-auth-library` against `GOOGLE_CLIENT_ID`; first sign-in links/creates the account.
- **Password reset**: `PasswordResetToken` rows with a TTL (`PASSWORD_RESET_TOKEN_TTL_MINUTES`, default 45), delivered by the email provider.
- **Vendor access** (ADR 005): a random token stored as a hash on the ticket/vendor record; the emailed link contains the raw token and grants access to exactly one ticket — a deliberate exception to the login model.

---

## 11. Frontend notes

- Almost every page is a client component (`'use client'`) talking to the API through `src/lib/api.ts` (`apiGet`, `apiPost`, `apiPatch`, `apiUpload`, `auth.*`), which centralises base URL, auth headers and 401→refresh→retry.
- No third-party component library: a small in-house kit lives in `components/ui/` (`Modal`, `Panel`, `Field`, `Select`, `StatusBadge`, `StatTile`, `EmptyState`, `LoadingScreen`, `VendorCombobox`, banners…), with design tokens in `globals.css` and `tailwind.config.js` (single blue accent scale, warm neutral scale, Plus Jakarta Sans for display / Inter for body).
- Role shells (`components/dashboard/*-shell.tsx`) own navigation; the guard dashboard uses one catch-all route that switches views.
- Uploads use `lib/useSignedUpload.ts`: browser asks the API for a signature, posts the file **directly to Cloudinary**, then confirms the asset — the API never proxies file bytes.

---

## 12. Running it locally

```bash
# 1. Database + Redis + backend in Docker
docker compose up -d

# 2. Backend env
cp backend/.env.example backend/.env     # fill in secrets you need

# 3. Schema + demo data
cd backend
npx prisma migrate deploy
npm run db:seed
```

```bash
# From the repo root
npm install
npm run dev        # frontend :3000 + backend :4000 via concurrently
npm test           # backend + shared tests
npm run build      # build all three workspaces
```

**Seeded demo data** (from `prisma/seed.ts`): society *Sunrise Apartments*, two buildings, five units, one admin, one resident, two vendors and an unpaid demo invoice.

| Login                    | Password        |
| ------------------------ | --------------- |
| `admin@sunrise.com`    | `admin123`    |
| `resident@sunrise.com` | `resident123` |

### Environment variables (`backend/.env`)

| Group            | Keys                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Database / cache | `DATABASE_URL`, `REDIS_URL`                                                                         |
| JWT              | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`    |
| Google           | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                          |
| URLs             | `PORT`, `FRONTEND_URL`, `API_PUBLIC_URL`                                                          |
| Payments         | `SAFEPAY_PUBLIC_KEY`, `SAFEPAY_PRIVATE_KEY`, `SAFEPAY_ENV`, `SAFEPAY_WEBHOOK_SECRET`            |
| Storage          | `CLOUDINARY_URL` / `CLOUDINARY_CLOUD_NAME`, `_API_KEY`, `_API_SECRET`                           |
| Email            | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`                            |
| Jobs (optional)  | `DUE_REMINDER_CRON`, `RECURRING_BILLING_CRON`, `PLATFORM_BILLING_CRON`, `PLATFORM_OVERDUE_CRON` |

Frontend needs only `NEXT_PUBLIC_API_URL`.

---

## 13. Testing

- **Vitest + Supertest**, run from `backend`: `npm test`.
- Route tests mock `lib/prisma` (hermetic — no database) and drive the real Express app over HTTP with signed JWTs, covering RBAC, validation and business rules (e.g. Safepay idempotency, vendor assignment for email-only vs phone-only, CSV import edge cases).
- Pure logic (permissions, pricing, CSV parsing, reminders, rate limits) is unit-tested directly.
- Current state: **371 tests / 29 files passing**; `tsc --noEmit` clean on backend and frontend. There is no CI workflow — tests are run locally.

---

## 14. Deployment

| Piece    | Where              | How                                                                                                                                                                                                                      |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend | Vercel             | `vercel.json` installs workspace deps, builds `@apartment/shared`, then Next                                                                                                                                         |
| Backend  | Railway            | `Dockerfile`: node:20-slim + openssl, builds `shared`, copies it into `backend/node_modules/@apartment/shared`, `prisma generate`, `tsc`; container start runs `prisma migrate deploy && node dist/index.js` |
| Database | Managed PostgreSQL | `DATABASE_URL`                                                                                                                                                                                                         |
| Redis    | Managed Redis      | Optional but needed for scheduled jobs                                                                                                                                                                                   |

Note: `stripe` is listed in backend dependencies but is **not imported anywhere** — Safepay is the only payment gateway in use.

---

## 15. Documentation map

| File                                    | Contents                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PLAN.md`                        | Master plan: principles, API conventions, phases, non-goals                                                                                        |
| `docs/PROGRESS.md`                    | Dated progress log per phase/slice, with verification notes                                                                                        |
| `docs/MASTER_PROJECT_INTELLIGENCE.md` | Deep audit: features, journeys, UI/UX, architecture, security, data model                                                                          |
| `docs/adr/001…008`                   | Auth mechanism, storage provider, payment gateway, email provider, vendor magic link, platform pricing, vendor entity, manual payment verification |
| `docs/MANUAL_TEST_GUIDE_*.md`         | Step-by-step manual verification scripts per feature                                                                                               |
| `docs/AGENTS.md`                      | Conventions for AI agents working in this repo                                                                                                     |

---

## 16. Status & known gaps

**Built and verified:** Phases 0–9 — foundation, core MVP, dues/payments, bookings, visitor management, governance (notices/polls), documents/audit, packages, vendor ratings, analytics, reminders, unit enhancements, staff, SOS alerts, recurring + platform billing, Google Sign-In, password reset, vendor magic links, manual payment proofs, Cloudinary uploads, bulk CSV import.

**Not built / watch items:**

- **Phase 10 (AI layer)** — planned only: a Python/FastAPI service with pgvector for semantic search. No AI code exists today.
- No CI pipeline; frontend has no automated tests.
- Vendors have no edit screen in the UI (`PATCH /api/v1/vendors/:id` exists and is tested, but the only form is the inline create on the assignment panel).
- Phone-only vendors get no automatic notification by design — the admin sends the link manually over WhatsApp, and nothing tracks whether they did.
- Gmail SMTP caps out around 500 emails/day (accepted in ADR 004).
- `stripe` and parts of `ioredis` are unused dependencies.
