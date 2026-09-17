# Master Project Intelligence

## OmniHome - Apartment Management Platform

> **Audit date:** August 28, 2026
> **Repository:** apartment-management (monorepo)
> **Audit scope:** Full codebase (frontend, backend, shared, config, docs)
> **Auditor:** Buffy (AI agent, evidence-based audit)
> **Overall confidence:** HIGH (all findings backed by source code evidence)

---

# 1. Executive Summary

**OmniHome** is a multi-tenant SaaS platform designed to replace WhatsApp groups, paper notices, and spreadsheets for residential community (apartment/society) management. It targets housing societies, apartment complexes, and gated communities in Pakistan.

**What it is:** A full-stack web application with role-based dashboards for committee administrators, residents, and security guards. It covers building/unit management, maintenance ticketing, dues invoicing with online payments (Safepay), visitor management with QR codes, amenity booking, community polls, document storage, parcel tracking, automated dues reminders, vendor ratings, and analytics - all with a complete audit trail.

**Who it serves:** Housing society committees (admins), residents, and security guards.

**Main problem:** Managing a residential community involves dozens of manual processes - collecting maintenance dues, tracking visitor access, managing complaints, posting notices - typically done through scattered WhatsApp messages, paper logs, and spreadsheets.

**Main solution:** One connected platform where every community workflow is centralized, role-scoped, and auditable.

**Technical stack:** Next.js 14 (App Router) + Express.js + Prisma + PostgreSQL + Redis + BullMQ + Safepay payment gateway + Tailwind CSS.

**Current maturity:** Phases 0–7 are complete (foundation, core MVP, money, bookings, security/visitor management, governance, documents/audit, and engagement/accountability). Phase 8 (AI layer) is planned but not started.

**Biggest strengths:** Comprehensive feature set across 12+ modules, solid multi-tenant architecture, role-based access control with a permission matrix, automated background jobs, real payment gateway integration, and a polished UI with dark mode support.

**Biggest weaknesses:** Notifications are stub-only (audit trail + console.log), Cloudinary file storage is configured but not wired (local disk only), email provider not selected, no mobile app, seed data is minimal for demo purposes.

---

# 2. Project Identity

| Attribute | Value |
|---|---|
| **Project name** | OmniHome |
| **Product category** | Multi-tenant SaaS - Residential Community Management |
| **One-sentence description** | A connected platform that replaces WhatsApp, paper notices, and spreadsheets for apartment society management. |
| **Primary purpose** | Centralize communication, maintenance, payments, visitor management, and governance for residential communities |
| **Target environment** | Web (responsive, mobile-friendly), deployed via Vercel (frontend) + Railway (backend) |
| **Intended users** | Housing society committee admins, residents, security guards |

---

# 3. Product Overview

OmniHome is a comprehensive apartment management platform built as a multi-tenant SaaS application. Each customer ("Society") gets an isolated workspace with complete data separation enforced through `societyId` scoping at the database query level.

The platform covers:
- **Property management** - buildings, units, resident assignments
- **Communication** - notices/announcements with read receipts, resident directory
- **Maintenance** - ticketing system with status lifecycle, photo attachments, vendor assignment, ratings
- **Financial** - invoicing, online payments via Safepay, payment history, dispute flow, automated dues reminders
- **Security** - QR-coded visitor passes, gate check-in/check-out, parcel tracking
- **Amenities** - booking system with conflict prevention and configurable rules
- **Governance** - community polls with one-vote-per-unit enforcement
- **Documents** - file storage with folder hierarchy
- **Operations** - audit trail, analytics dashboard, committee transition export

---

# 4. Problem Analysis

| Problem | Affected User | Pain | Project Feature | Evidence |
|---|---|---|---|---|
| Dues collection relies on door-to-door chasing | Admin | Manual, inconsistent collection | Invoice generation + Safepay online payments | `backend/src/routes/invoices.ts`, `backend/src/routes/payments.ts` |
| Visitor access managed via phone calls to residents | Guard, Resident | Security bottleneck, delayed approvals | QR-coded visitor passes with gate verification | `backend/src/routes/visitors.ts`, `frontend/src/app/dashboard/guard/page.tsx` |
| Maintenance requests via WhatsApp get lost | Resident, Admin | No tracking, no accountability | Ticket system with status lifecycle + comments | `backend/src/routes/tickets.ts` |
| Paper notices don't reach all residents | Admin, Resident | Poor communication | Digital notices with read receipts | `backend/src/routes/notices.ts` |
| No structured way to vote on community matters | Resident | Paper ballots, low participation | Polls with one-vote-per-unit | `backend/src/routes/polls.ts` |
| Documents scattered across personal devices | Admin, Resident | Lost contracts, bylaws | Centralized document storage with folders | `backend/src/routes/documents.ts` |
| No visibility into operational metrics | Admin | Can't measure performance | Analytics dashboard | `backend/src/routes/analytics.ts` |
| Vendor accountability is informal | Admin | Overcharging, underdelivering | Vendor ratings on ticket closure | `backend/src/routes/tickets.ts` (vendor-ratings endpoint) |
| Parcels/packages arrive without tracking | Guard, Resident | Missed deliveries | Parcel tracking with photo | `backend/src/routes/parcels.ts` |
| Dues reminders are manual and inconsistent | Admin | Residents forget to pay | Automated BullMQ-based reminders | `backend/src/lib/due-reminders.ts`, `backend/src/queue/index.ts` |

---

# 5. Target Users & Stakeholders

| Role | Purpose | Access Level |
|---|---|---|
| **Committee Admin** | Manages the society - buildings, units, residents, notices, tickets, invoices, amenities, polls, documents | Full access to all modules, admin dashboard |
| **Resident** | Lives in the society - raises tickets, pays dues, books amenities, votes, creates visitor passes | Scoped to own unit(s), resident dashboard |
| **Security Guard** | Manages gate access - verifies QR passes, logs gate entry/exit, logs parcel arrivals | Visitor verification, gate logs, parcel logging |
| **Super Admin** | Platform-level administrative account (internal use) | Everything a committee admin can do, plus society management |
| **Vendor** | Referenced by name on tickets (no self-service portal in current implementation) | No direct system access |

---

# 6. User Roles & Permissions

**Evidence:** `backend/src/lib/permissions.ts` - complete permission matrix

| Resource | SUPER_ADMIN | COMMITTEE_ADMIN | RESIDENT | SECURITY_GUARD |
|---|---|---|---|---|
| society | read, update, manage | read, update | read | - |
| building | CRUD | CRUD | read | - |
| unit | CRUD | CRUD | read | - |
| membership | CRUD, invite | CRUD, invite | read | - |
| user | read, update | read, update | read, update | - |
| notice | CRUD | CRUD | read | - |
| ticket | CRUD | CRUD | create, read | - |
| invoice | CRUD | CRUD | read | - |
| amenity | CRUD | CRUD | read | - |
| booking | CRUD | CRUD | create, read | - |
| visitor | CRUD | CRUD | create, read, update | read |
| gate_log | create, read | create, read | - | create, read |
| poll | CRUD | CRUD | read | - |
| document | CRUD | CRUD | read | - |
| parcel | CRUD | CRUD | read, update | create, read |
| audit_log | read | read | - | - |
| vendor | read | read | - | - |
| analytics | read | read | - | - |

---

# 7. Complete Feature Inventory

| # | Feature | Status | User(s) | What It Does | Evidence |
|---|---|---|---|---|---|
| 1 | Society Signup (Tenant Onboarding) | ✅ Implemented | Admin | Creates Society + User + Membership in one transaction | `backend/src/routes/auth.ts` POST /signup |
| 2 | Login / Logout | ✅ Implemented | All | JWT access+refresh tokens, httpOnly cookies | `backend/src/routes/auth.ts` |
| 3 | Token Refresh | ✅ Implemented | All | Silent access token renewal via refresh token | `backend/src/routes/auth.ts` POST /refresh |
| 4 | User Profile (me) | ✅ Implemented | All | Returns user profile + memberships | `backend/src/routes/auth.ts` GET /me |
| 5 | Resident Invite | ✅ Implemented | Admin | Invite by email, auto-creates user with temp password | `backend/src/routes/auth.ts` POST /invite |
| 6 | Membership Revoke | ✅ Implemented | Admin | Revokes membership + auto-cancels visitor passes | `backend/src/routes/auth.ts` POST /memberships/:id/revoke |
| 7 | Building CRUD | ✅ Implemented | Admin | Create, list, update, soft-delete buildings | `backend/src/routes/buildings.ts` |
| 8 | Unit CRUD | ✅ Implemented | Admin | Create, list, update, soft-delete units with type tracking | `backend/src/routes/units.ts` |
| 9 | Notice CRUD | ✅ Implemented | Admin create, Resident read | Create, publish, draft, update, soft-delete notices | `backend/src/routes/notices.ts` |
| 10 | Notice Read Receipts | ✅ Implemented | Resident | Tracks who has read each notice | `backend/src/routes/notices.ts` GET /:id |
| 11 | Resident Directory | ✅ Implemented | All | Searchable directory with building-grouped view | `backend/src/routes/directory.ts` |
| 12 | Maintenance Tickets | ✅ Implemented | Resident create, Admin manage | Full status lifecycle (OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED) | `backend/src/routes/tickets.ts` |
| 13 | Ticket Comments | ✅ Implemented | Resident, Admin | Threaded comments on tickets | `backend/src/routes/tickets.ts` POST /:id/comments |
| 14 | Ticket Photo Upload | ✅ Implemented | Resident, Admin | Upload photos (JPEG/PNG/WebP/GIF, 10MB max) | `backend/src/routes/tickets.ts` POST /:id/photos |
| 15 | Vendor Ratings | ✅ Implemented | Admin | 1-5 star rating + comment on ticket closure | `backend/src/routes/tickets.ts` PATCH /:id |
| 16 | Vendor Rating Aggregation | ✅ Implemented | Admin | Average rating + count per vendor name | `backend/src/routes/tickets.ts` GET /vendor-ratings |
| 17 | Invoice CRUD | ✅ Implemented | Admin create, Resident read | Create invoices per unit with auto-generated invoice numbers | `backend/src/routes/invoices.ts` |
| 18 | Invoice Dispute | ✅ Implemented | Resident | Flag an invoice as disputed with reason | `backend/src/routes/invoices.ts` POST /:id/dispute |
| 19 | Online Payment (Safepay) | ✅ Implemented | Resident | Hosted checkout flow with webhook verification | `backend/src/routes/invoices.ts` POST /:id/pay |
| 20 | Payment Webhook | ✅ Implemented | System | HMAC-SHA512 verified Safepay webhook handling | `backend/src/routes/payments.ts` POST /webhook |
| 21 | Payment Verification Fallback | ✅ Implemented | Resident | Server-side reconciliation check | `backend/src/routes/payments.ts` POST /:tracker/verify |
| 22 | Payment History | ✅ Implemented | All | List of past payments with status | `backend/src/routes/invoices.ts` GET /payments/history |
| 23 | Amenity CRUD | ✅ Implemented | Admin | Create, list, update amenities with booking rules | `backend/src/routes/amenities.ts` |
| 24 | Amenity Booking | ✅ Implemented | Resident | Book amenities with conflict detection, duration/advance/daily limits | `backend/src/routes/amenities.ts` POST /book |
| 25 | Booking Cancel | ✅ Implemented | Resident, Admin | Cancel confirmed bookings | `backend/src/routes/amenities.ts` POST /bookings/:id/cancel |
| 26 | Visitor Pass CRUD | ✅ Implemented | Resident create, Admin manage | Create visitor passes with QR tokens | `backend/src/routes/visitors.ts` |
| 27 | QR Verification at Gate | ✅ Implemented | Guard | Verify visitor pass by QR token | `backend/src/routes/visitors.ts` POST /verify/:qrToken |
| 28 | Gate Entry/Exit Logging | ✅ Implemented | Guard | Record check-in/check-out with gate log | `backend/src/routes/visitors.ts` POST /:id/gate |
| 29 | Visitor Pass Auto-Approval on Scan | ✅ Implemented | Guard | Auto-approves pending passes on QR scan | `backend/src/routes/visitors.ts` POST /verify/:qrToken |
| 30 | Visitor Pass Auto-Revoke on Membership Revocation | ✅ Implemented | System | Cancels pending/approved passes when membership revoked | `backend/src/routes/auth.ts` POST /memberships/:id/revoke |
| 31 | Poll CRUD | ✅ Implemented | Admin | Create, activate, close, update polls | `backend/src/routes/polls.ts` |
| 32 | Vote Casting | ✅ Implemented | Resident | One-vote-per-unit enforcement | `backend/src/routes/polls.ts` POST /:id/vote |
| 33 | Poll Results Visibility | ✅ Implemented | All | LIVE / AFTER_CLOSE / NEVER options | `backend/src/routes/polls.ts` GET /:id/results |
| 34 | Document Folder CRUD | ✅ Implemented | Admin | Create, update, soft-delete hierarchical folders | `backend/src/routes/documents.ts` /folders |
| 35 | Document Upload & Download | ✅ Implemented | Admin upload, All download | File upload (50MB max) with download | `backend/src/routes/documents.ts` |
| 36 | Parcel Tracking | ✅ Implemented | Guard log, Resident view | Log arrivals with photo, mark collected | `backend/src/routes/parcels.ts` |
| 37 | Automated Dues Reminders | ✅ Implemented | System (BullMQ) | Scheduled daily job scanning unpaid invoices | `backend/src/lib/due-reminders.ts`, `backend/src/queue/index.ts` |
| 38 | Dues Reminder Settings | ✅ Implemented | Admin | Configure days-before reminder window (1-30) | `backend/src/routes/settings.ts` |
| 39 | Manual Reminder Trigger | ✅ Implemented | Admin | On-demand reminder run for own society | `backend/src/routes/settings.ts` POST /run-reminders |
| 40 | Audit Trail | ✅ Implemented | Admin | Every mutation writes to AuditLog with before/after snapshots | `backend/src/lib/audit.ts`, `backend/src/routes/audit-log.ts` |
| 41 | Audit Log Export | ✅ Implemented | Admin | JSON export for committee transition | `backend/src/routes/audit-log.ts` GET /export |
| 42 | Admin Analytics Dashboard | ✅ Implemented | Admin | Dues collection rate, ticket resolution time, category volume, vendor performance | `backend/src/routes/analytics.ts` |
| 43 | Dark Mode | ✅ Implemented | All | Theme toggle persisted in localStorage | `frontend/src/lib/theme.tsx` |
| 44 | Mobile Bottom Navigation | ✅ Implemented | Resident | Fixed bottom nav on mobile | `frontend/src/components/dashboard/resident-shell.tsx` |
| 45 | Guard Interface (Tablet-Friendly) | ✅ Implemented | Guard | QR scan, parcel logging, mode switching | `frontend/src/app/dashboard/guard/page.tsx` |
| 46 | Landing Page | ✅ Implemented | Public | Marketing page with features, pricing, FAQ, testimonials | `frontend/src/app/page.tsx` |
| 47 | Notification Delivery (Email/Push) | ❌ Not Found | - | Notifications are logged to audit trail + console only | `backend/src/lib/notifications.ts` (stub) |
| 48 | Cloudinary File Storage | 🟠 UI/Mock Only | - | Cloudinary env vars configured but files stored locally on disk | `backend/src/routes/documents.ts` uses multer diskStorage |
| 49 | Token Blacklisting (Redis) | 🔵 Planned | - | TODO comment in logout endpoint | `backend/src/routes/auth.ts` POST /logout |
| 50 | Native Mobile App | 🔵 Planned | - | Referenced in landing page FAQ | `frontend/src/app/page.tsx` FAQ section |
| 51 | Email Verification on Signup | 🔵 Planned | - | Explicitly deferred in PLAN.md | `docs/PLAN.md` Phase 7 notes |
| 52 | AI Layer (Phase 8) | 🔵 Planned | - | pgvector, RAG, anomaly detection | `docs/PLAN.md` Phase 8 |

---

# 8. Feature Implementation Status

| Area | Status | Confidence | Evidence |
|---|---|---|---|
| Authentication | ✅ Implemented | High | JWT access+refresh, bcrypt, httpOnly cookies |
| Society Onboarding | ✅ Implemented | High | Atomic signup creates Society+User+Membership |
| Building/Unit Management | ✅ Implemented | High | Full CRUD with soft-delete, audit logging |
| Resident Management | ✅ Implemented | High | Invite flow, membership revoke, directory |
| Notice/Announcements | ✅ Implemented | High | CRUD, publish/draft, read receipts |
| Maintenance Ticketing | ✅ Implemented | High | Full lifecycle, comments, photos, vendor ratings |
| Invoicing | ✅ Implemented | High | CRUD, dispute, auto-numbering |
| Online Payments | ✅ Implemented | High | Safepay hosted checkout, webhooks, reconciliation |
| Amenity Booking | ✅ Implemented | High | Conflict detection, configurable rules |
| Visitor Management | ✅ Implemented | High | QR passes, gate logs, auto-revoke |
| Polls/Voting | ✅ Implemented | High | One-vote-per-unit, results visibility |
| Document Storage | ✅ Implemented | High | Folder hierarchy, upload/download, local disk |
| Parcel Tracking | ✅ Implemented | High | Arrival logging, collection, photo |
| Automated Dues Reminders | ✅ Implemented | High | BullMQ job, configurable window |
| Vendor Ratings | ✅ Implemented | High | 1-5 stars, aggregation |
| Analytics Dashboard | ✅ Implemented | High | Dues rate, resolution time, categories, vendors |
| Audit Trail | ✅ Implemented | High | Every mutation logged, search, filter, export |
| Notifications (Email/Push) | ❌ Not Found | High | Stub only - audit trail + console.log |
| Rate Limiting | 🔵 Planned | Medium | Redis-backed limiter mentioned in PLAN.md but not implemented |
| Frontend Tests | ❌ Not Found | High | No frontend test files detected |
| Backend Tests | ✅ Implemented | High | 10 test files, Vitest + Supertest |

---

# 9. Major User Journeys

## Journey 1: Society Onboarding (Admin Signup)
1. **Who:** Committee Admin
2. **Entry:** `/signup`
3. **Actions:** Enter name, email, password, society name → auto-generates slug → submit
4. **Frontend:** `frontend/src/app/signup/page.tsx`
5. **API:** `POST /api/v1/auth/signup`
6. **Backend:** Creates Society + User + Membership in Prisma transaction → issues JWT tokens
7. **Database:** Creates Society, User, Membership, AuditLog records
8. **Result:** Redirected to admin dashboard (`/dashboard/admin`)

## Journey 2: Resident Login
1. **Who:** Resident
2. **Entry:** `/login`
3. **Actions:** Enter email + password → submit
4. **Frontend:** `frontend/src/app/login/page.tsx`
5. **API:** `POST /api/v1/auth/login`
6. **Backend:** Verifies credentials → loads memberships → issues tokens
7. **Result:** Redirected to `/dashboard/resident`

## Journey 3: Maintenance Ticket Lifecycle
1. **Who:** Resident → Admin
2. **Resident actions:** Create ticket (title, description, category, optional photo) → status: OPEN
3. **Admin actions:** Assign vendor → status: ASSIGNED → mark IN_PROGRESS → mark RESOLVED → CLOSE + rate (1-5 stars)
4. **API:** `POST /api/v1/tickets` → `PATCH /api/v1/tickets/:id` (multiple updates)
5. **Audit:** Every status change logged with before/after snapshots
6. **Notifications:** Console + audit trail for each status change

## Journey 4: Online Dues Payment
1. **Who:** Resident
2. **Resident actions:** View invoices → click Pay on unpaid invoice → redirected to Safepay hosted checkout → complete payment → redirected back
3. **API:** `POST /api/v1/invoices/:id/pay` → Safepay redirect → `POST /api/v1/payments/webhook` (webhook)
4. **Backend:** Creates Safepay tracker → stores pending Payment → webhook updates Payment to succeeded → marks Invoice as PAID
5. **Verification:** `POST /api/v1/invoices/:id/verify-payment` as reconciliation fallback

## Journey 5: Visitor Management
1. **Who:** Resident → Guard
2. **Resident:** Create visitor pass → QR token generated → share QR/ token with visitor
3. **Guard:** Scan/enter QR token → `POST /api/v1/visitors/verify/:qrToken` → auto-approves if pending → check-in → check-out
4. **API:** `POST /api/v1/visitors` → `POST /api/v1/visitors/verify/:qrToken` → `POST /api/v1/visitors/:id/gate`
5. **Auto-revoke:** When membership revoked, all pending/approved passes for that unit cancelled

---

# 10. Product Value Analysis

| Feature | User Problem | Value | Benefit |
|---|---|---|---|
| Invoice + Online Payment | Dues collection is manual and inconsistent | **HIGH** | Reduces admin effort, increases collection rate, provides financial transparency |
| Maintenance Ticketing | Requests get lost in WhatsApp | **HIGH** | Structured tracking, accountability, resolution time visibility |
| Visitor QR Passes | Phone-call-based gate access is slow and insecure | **HIGH** | Digital verification, audit trail, auto-expire |
| Audit Trail | No record of who did what | **HIGH** | Accountability, committee transition support, dispute resolution |
| Notices with Read Receipts | Paper notices don't reach everyone | **MEDIUM** | Confirmation of delivery, reduced miscommunication |
| Amenity Booking | Double-bookings and conflicts | **MEDIUM** | Conflict prevention, configurable rules |
| Community Polls | Paper ballots are inefficient | **MEDIUM** | Digital democracy, transparent results |
| Analytics Dashboard | No visibility into operational metrics | **MEDIUM** | Data-driven decisions for admins |
| Vendor Ratings | No vendor accountability | **MEDIUM** | Performance tracking, informed vendor selection |
| Document Storage | Scattered documents across devices | **MEDIUM** | Centralized, organized, accessible |
| Parcel Tracking | Missed deliveries | **LOW** | Basic tracking, notification on arrival |
| Automated Dues Reminders | Manual reminder follow-up | **LOW** | Reduces admin workload |

---

# 11. Key Differentiators

## Verified Differentiators (Evidence-Based)

1. **Multi-tenant architecture with structural isolation** - Every query is scoped by `societyId` through a repository pattern, not by convention. This is architecturally enforced, not just assumed.
   - Evidence: `backend/src/db/tenant-scope.ts`, all route handlers include `societyId` in queries

2. **Complete audit trail as infrastructure** - Every mutating operation writes before/after JSON snapshots to AuditLog, with export capability for committee transitions.
   - Evidence: `backend/src/lib/audit.ts`, `backend/src/routes/audit-log.ts`

3. **QR-coded visitor management with gate logging** - Residents pre-authorize visitors, guards scan QR codes, entry/exit is tracked.
   - Evidence: `backend/src/routes/visitors.ts`, `frontend/src/app/dashboard/guard/page.tsx`

4. **Automated dues reminders via background job queue** - BullMQ-powered scheduled reminders with configurable per-society windows.
   - Evidence: `backend/src/queue/index.ts`, `backend/src/lib/due-reminders.ts`

5. **Role-based permission matrix with hierarchy** - Five roles with resource-level permissions, hierarchy inheritance, and RBAC middleware.
   - Evidence: `backend/src/lib/permissions.ts`, `backend/src/middleware/rbac.ts`

## Potential Differentiators

6. **Guard-specific tablet-friendly interface** - Purpose-built interface for security guards with large touch targets and mode switching.
7. **Vendor rating system** - 1-5 star ratings tied to ticket closure with aggregation.
8. **Invoice dispute mechanism** - Residents can flag invoices they disagree with.

---

# 12. UI/UX Audit

## Strengths

- **Polished landing page** with scroll-reveal animations, editorial feature rows, pricing cards, FAQ accordion, and testimonials (`frontend/src/app/page.tsx`)
- **Consistent design system** - reusable UI components: Card, StatusBadge, PageHeader, StatCard, EmptyState
- **Role-based dashboards** - separate admin, resident, and guard interfaces with appropriate navigation
- **Dark mode support** via ThemeProvider with localStorage persistence
- **Mobile responsive** - bottom navigation for residents, responsive grids throughout
- **Guard interface** designed for tablet use with large touch targets and minimal complexity
- **Attention-driven dashboards** - both admin and resident dashboards highlight items needing attention
- **Status badges** with consistent color coding across the application
- **Loading states** with spinner animations on all dashboard shells

## Weaknesses

- **No search/filter on many list pages** - tickets, visitors, parcels could benefit from search
- **No pagination UI** - cursor-based API pagination exists but frontend doesn't implement infinite scroll or load-more
- **No empty state illustrations** - functional but minimal empty states
- **No form validation feedback** - backend validation exists, but frontend forms rely on HTML5 validation only
- **No toast/notification system** - success/error messages are inline, not persistent
- **Guard "Recent Activity" tab** is a placeholder (empty state only)

## Presentation-Worthy Screens

1. **Admin Dashboard** (`/dashboard/admin`) - summary cards, attention items, recent tickets
2. **Resident Dashboard** (`/dashboard/resident`) - quick actions grid, attention items, activity feed
3. **Guard Interface** (`/dashboard/guard`) - QR verification, visitor details card, gate actions
4. **Landing Page Hero** - modern design with floating product preview cards
5. **Admin Analytics** (`/dashboard/admin/analytics`) - charts and performance metrics

---

# 13. Technical Architecture

```
User (Browser)
    ↓
Frontend (Next.js 14 App Router)
    ├── Pages: /login, /signup, /dashboard/admin/*, /dashboard/resident/*, /dashboard/guard
    ├── Components: admin-shell, resident-shell, UI library (Card, StatusBadge, etc.)
    ├── API Client: api.ts (fetch wrapper with token refresh)
    └── Styling: Tailwind CSS with custom theme
    ↓
API (Express.js + TypeScript)
    ├── Middleware: auth (JWT verify), RBAC (permission check), error-handler
    ├── Routes: 16 route modules (auth, notices, tickets, invoices, buildings, units, amenities, visitors, polls, documents, parcels, payments, audit-log, settings, analytics, directory)
    ├── Lib: auth (JWT/bcrypt), permissions, audit, notifications, payment-provider, payment-processing, due-reminders, response helpers
    ├── DB: tenant-scope repository pattern
    └── Queue: BullMQ worker for automated dues reminders
    ↓
Database (PostgreSQL via Prisma ORM)
    ├── 18 models: Society, Building, Unit, User, Membership, Notice, Ticket, TicketComment, NoticeReadReceipt, Invoice, Payment, Amenity, Booking, VisitorPass, GateLog, Poll, Vote, Document, DocumentFolder, Parcel, InvoiceReminder, AuditLog
    └── Soft-delete pattern on all tenant-scoped entities
    ↓
External Services
    ├── Redis (BullMQ queue for due reminders)
    ├── Safepay (payment gateway - hosted checkout)
    └── Local file storage (documents, ticket photos, parcel photos)
```

---

# 14. Database & Data Model

## Main Entities

| Entity | Purpose | Key Relationships |
|---|---|---|
| **Society** | Tenant (one per customer) | Has buildings, units, memberships, all tenant data |
| **Building** | Physical building within society | Belongs to Society, has Units |
| **Unit** | Individual apartment/flat | Belongs to Building + Society, has memberships, invoices, bookings |
| **User** | Global identity (not tenant-scoped) | Has memberships, tickets, votes, visitor passes |
| **Membership** | Joins User to Society with Role + Unit | Links User, Society, Unit; determines permissions |
| **Ticket** | Maintenance request | Belongs to Society + Resident + Unit; has comments, ratings |
| **Invoice** | Maintenance dues charge | Belongs to Society + Unit; has payments |
| **Payment** | Payment record for invoice | Belongs to Invoice + Society; tracks Safepay session |
| **VisitorPass** | Pre-authorized visitor entry | Belongs to Society + Unit + Resident; has QR token, gate logs |
| **GateLog** | Visitor entry/exit record | Belongs to VisitorPass + Guard |
| **Notice** | Society announcement | Belongs to Society + Author; has read receipts |
| **Poll** | Community vote | Belongs to Society; has votes (one per unit) |
| **Amenity** | Bookable facility | Belongs to Society; has bookings |
| **Booking** | Amenity reservation | Belongs to Amenity + Unit + Resident |
| **Document** | Uploaded file | Belongs to Society + optional Folder |
| **DocumentFolder** | Folder hierarchy | Self-referencing parent/children |
| **Parcel** | Package tracking | Belongs to Society + Unit; logged by guard, collected by resident |
| **InvoiceReminder** | Automated reminder record | Belongs to Invoice + Society; unique on (invoiceId, dueDate) |
| **AuditLog** | Change tracking | Belongs to Society; records every mutation |

## Enumerations

- **Role:** SUPER_ADMIN, COMMITTEE_ADMIN, RESIDENT, SECURITY_GUARD, VENDOR
- **MembershipStatus:** ACTIVE, REVOKED
- **UnitType:** OWNER_OCCUPIED, RENTED, VACANT
- **InvoiceStatus:** DRAFT, ISSUED, PAID, OVERDUE, CANCELLED, DISPUTED
- **TicketStatus:** OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED
- **BookingStatus:** CONFIRMED, CANCELLED, COMPLETED
- **PollStatus:** DRAFT, ACTIVE, CLOSED
- **ResultsVisibility:** LIVE, AFTER_CLOSE, NEVER
- **VisitorPassStatus:** PENDING, APPROVED, CHECKED_IN, CHECKED_OUT, EXPIRED, CANCELLED
- **GateLogAction:** ENTRY, EXIT
- **ParcelStatus:** ARRIVED, COLLECTED

---

# 15. API Audit

## Key API Endpoints

| Method | Route | Purpose | Auth | Role Required | Evidence |
|---|---|---|---|---|---|
| POST | /api/v1/auth/signup | Create society + admin | No | - | `auth.ts` |
| POST | /api/v1/auth/login | Authenticate user | No | - | `auth.ts` |
| POST | /api/v1/auth/refresh | Refresh access token | No | - | `auth.ts` |
| GET | /api/v1/auth/me | Get current user profile | Yes | Any | `auth.ts` |
| POST | /api/v1/auth/invite | Invite resident/guard | Yes | Committee Admin | `auth.ts` |
| POST | /api/v1/auth/memberships/:id/revoke | Revoke membership | Yes | Committee Admin | `auth.ts` |
| GET | /api/v1/buildings | List buildings | Yes | Any | `buildings.ts` |
| POST | /api/v1/buildings | Create building | Yes | Committee Admin | `buildings.ts` |
| GET | /api/v1/units | List units | Yes | Any | `units.ts` |
| POST | /api/v1/units | Create unit | Yes | Committee Admin | `units.ts` |
| POST | /api/v1/notices | Create notice | Yes | Committee Admin | `notices.ts` |
| GET | /api/v1/notices | List notices (cursor-paginated) | Yes | Any | `notices.ts` |
| POST | /api/v1/tickets | Create ticket | Yes | Resident | `tickets.ts` |
| GET | /api/v1/tickets | List tickets (cursor-paginated) | Yes | Any | `tickets.ts` |
| PATCH | /api/v1/tickets/:id | Update ticket/status/rating | Yes | Committee Admin | `tickets.ts` |
| GET | /api/v1/tickets/vendor-ratings | Aggregated vendor ratings | Yes | Committee Admin | `tickets.ts` |
| POST | /api/v1/invoices | Create invoice | Yes | Committee Admin | `invoices.ts` |
| POST | /api/v1/invoices/:id/pay | Initiate Safepay payment | Yes | Resident (unit owner) | `invoices.ts` |
| POST | /api/v1/invoices/:id/dispute | Dispute invoice | Yes | Resident (unit owner) | `invoices.ts` |
| POST | /api/v1/payments/webhook | Safepay webhook (public) | No (signature-verified) | - | `payments.ts` |
| POST | /api/v1/amenities/book | Book amenity slot | Yes | Resident | `amenities.ts` |
| POST | /api/v1/visitors | Create visitor pass | Yes | Resident | `visitors.ts` |
| POST | /api/v1/visitors/verify/:qrToken | Verify QR at gate | Yes | Guard/Admin | `visitors.ts` |
| POST | /api/v1/visitors/:id/gate | Log gate entry/exit | Yes | Guard/Admin | `visitors.ts` |
| POST | /api/v1/polls/:id/vote | Cast vote | Yes | Resident | `polls.ts` |
| POST | /api/v1/documents/upload | Upload document | Yes | Committee Admin | `documents.ts` |
| POST | /api/v1/parcels | Log parcel arrival | Yes | Guard/Admin | `parcels.ts` |
| GET | /api/v1/audit-logs | Search/filter audit logs | Yes | Committee Admin | `audit-log.ts` |
| GET | /api/v1/audit-logs/export | Export audit logs JSON | Yes | Committee Admin | `audit-log.ts` |
| GET | /api/v1/analytics | Admin analytics | Yes | Committee Admin | `analytics.ts` |
| PATCH | /api/v1/settings | Update society settings | Yes | Committee Admin | `settings.ts` |
| POST | /api/v1/settings/run-reminders | Manual reminder trigger | Yes | Committee Admin | `settings.ts` |
| GET | /api/v1/directory | Searchable resident directory | Yes | Any | `directory.ts` |

---

# 16. Authentication & Authorization

## Authentication
- **Mechanism:** Custom JWT (access + refresh tokens)
- **Password hashing:** bcryptjs with 12 salt rounds
- **Token storage:** httpOnly cookies (secure, sameSite: none) + localStorage fallback for cross-origin
- **Access token lifetime:** 15 minutes
- **Refresh token lifetime:** 7 days
- **Token extraction:** `x-access-token` header or `token` cookie
- **Refresh extraction:** `x-refresh-token` header or `refreshToken` cookie
- **Evidence:** `backend/src/lib/auth.ts`, `backend/src/middleware/auth.ts`

## Authorization
- **RBAC middleware:** `requireRole(action, resource)` factory pattern
- **Permission matrix:** Role hierarchy (SUPER_ADMIN > COMMITTEE_ADMIN > RESIDENT > SECURITY_GUARD > VENDOR)
- **Membership loading:** Auto-detects single membership, requires `x-society-id` header for multiple
- **Evidence:** `backend/src/lib/permissions.ts`, `backend/src/middleware/rbac.ts`

## Security Observations
- Token refresh silently handles expired access tokens (frontend retry logic in `api.ts`)
- Logout clears cookies but does NOT blacklist refresh tokens (TODO noted in code)
- CORS is set to `origin: true` (allows any origin with credentials) - appropriate for development, needs restriction in production
- JWT secrets have dev fallbacks - production deployment must set proper secrets

---

# 17. Validation & Error Handling

## Frontend Validation
- HTML5 `required` attributes on form fields
- Zod schemas defined in shared package (imported by backend)
- **No frontend Zod validation** - forms rely on browser validation + backend error responses

## Backend Validation
- **Zod** at every route boundary before business logic
- Prisma unique constraint handling (P2002 → 409 CONFLICT)
- Prisma not-found handling (P2025 → 404 NOT_FOUND)
- Custom AppError class with error codes
- Payment gateway errors caught and translated to user-friendly messages
- Error handler middleware processes all error types centrally

## Error Response Format
```json
{ "data": null, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

## Observations
- Backend validation is thorough and consistent
- Frontend could benefit from real-time form validation using the shared Zod schemas
- Error messages are user-friendly (no stack traces leaked)
- Loading states are implemented on all dashboard shells

---

# 18. QA & Testing Audit

## Test Framework
- **Vitest** (backend + shared)
- **Supertest** (API integration tests)

## Test Files Found (10)
| File | Purpose |
|---|---|
| `backend/src/index.test.ts` | Health check endpoint |
| `backend/src/routes/tickets.test.ts` | Ticket CRUD + status transitions |
| `backend/src/routes/tickets-ratings.test.ts` | Vendor rating rules + aggregation |
| `backend/src/routes/notices.test.ts` | Notice CRUD + read receipts |
| `backend/src/routes/payments.test.ts` | Payment webhook + Safepay integration |
| `backend/src/routes/settings.test.ts` | Settings + reminder trigger |
| `backend/src/routes/analytics.test.ts` | Analytics aggregation |
| `backend/src/lib/due-reminders.test.ts` | Due reminder selection logic |
| `backend/src/lib/permissions.test.ts` | Permission matrix |
| `backend/src/lib/__tests__/validation.test.ts` | Zod schema validation |

## Test Coverage
- Per PROGRESS.md: 99/99 tests passing as of Phase 7 Slice 4
- Tests cover: ticket status transitions, rating rules, permission matrix, payment webhook verification, reminder idempotency, analytics aggregation
- **No frontend tests** - no test files found in frontend directory
- **No end-to-end tests** - no Cypress/Playwright detected

## Manual Testing
- PROGRESS.md contains manual test guides for each slice
- Seed data: `admin@sunrise.com` / `admin123`, `resident@sunrise.com` / `resident123`

---

# 19. Code Quality Audit

## Strengths
- **Consistent architecture** - every route follows: validate → auth → RBAC → tenant-scoped DB → audit log → response
- **TypeScript strict mode** - used throughout
- **Shared types** - Zod schemas and TypeScript interfaces in shared package, imported by both frontend and backend
- **Soft-delete pattern** - consistent `deletedAt` column on all tenant-scoped entities
- **Separation of concerns** - middleware, lib, routes, db layers well-separated
- **Audit logging as infrastructure** - single `logAudit()` helper used everywhere
- **Payment provider abstraction** - `PaymentProvider` interface allows provider swap
- **Graceful degradation** - BullMQ queue starts in "disabled" mode if Redis unavailable

## Areas for Improvement
- **No frontend tests** - significant gap for a production application
- **Duplicated `getUserUnitIds` helper** - appears in invoices.ts, visitors.ts, polls.ts, parcels.ts (should be extracted)
- **Some `any` types** in route handlers for Prisma query results
- **No rate limiting** - mentioned in PLAN.md but not implemented
- **File uploads stored locally** - not production-ready (Cloudinary/S3 needed)
- **CORS wide open** - `origin: true` allows any origin

---

# 20. Performance & Scalability

## Observed Patterns
- Cursor-based pagination on list endpoints (not offset-based) - good for large datasets
- Database indexes on all `societyId` columns - prevents full table scans per tenant
- Composite indexes on high-traffic queries (`[societyId, status]`, `[societyId, createdAt]`)
- Prisma connection pooling with singleton pattern in development

## Potential Risks
- **N+1 queries** on some list endpoints that include related data (e.g., tickets with resident name + unit number)
- **No caching layer** - every request hits PostgreSQL directly
- **File uploads on local disk** - not scalable, no CDN
- **Analytics queries** scan all tickets/invoices for the society - could be slow with large datasets
- **No pagination UI** - all list data loaded at once in some frontend pages

---

# 21. Security Audit

## Implemented
- JWT authentication with httpOnly cookies
- bcrypt password hashing (12 rounds)
- RBAC middleware on all protected routes
- Tenant-scoping prevents cross-society data access
- Safepay webhook signature verification (HMAC-SHA512 with timing-safe comparison)
- File upload type and size validation (server-side)
- Zod input validation on all API endpoints
- Error messages don't leak stack traces or internal details

## Concerns
- **Token blacklisting not implemented** - logout doesn't invalidate refresh tokens
- **CORS wide open** (`origin: true, credentials: true`) - any origin can make authenticated requests
- **JWT secrets have dev fallbacks** - production must override
- **No rate limiting** - auth endpoints vulnerable to brute force
- **No CSRF protection** - relying on SameSite cookie attribute
- **File uploads stored without access control** - ticket photos and documents served without auth on the photo download endpoint (`/photo/:filename`)
- **SQL injection not possible** - Prisma ORM uses parameterized queries

---

# 22. Dependencies & Configuration

## Core Dependencies
| Package | Version | Purpose |
|---|---|---|
| next | ^14.2.3 | Frontend framework |
| react / react-dom | ^18.3.1 | UI library |
| express | ^4.19.2 | Backend API |
| @prisma/client | ^5.14.0 | Database ORM |
| prisma | ^5.14.0 | Schema/migration tool |
| zod | ^3.23.8 | Validation |
| jsonwebtoken | ^9.0.2 | JWT auth |
| bcryptjs | ^2.4.3 | Password hashing |
| bullmq | ^6.1.2 | Job queue |
| ioredis | ^5.4.1 | Redis client |
| stripe | ^22.3.2 | Listed but NOT used (Safepay is used) |
| multer | ^2.2.0 | File uploads |
| tailwindcss | ^3.4.3 | Styling |
| lucide-react | ^0.379.0 | Icons |
| qrcode.react | ^4.2.0 | QR code rendering |
| vitest | ^1.6.0 | Test framework |
| supertest | ^7.0.0 | API testing |

## Observations
- `stripe` is in package.json but the project uses Safepay - dead dependency
- `ioredis` is installed but token blacklisting not implemented yet
- `@types/multer` installed - indicates multer integration is real

## Environment Variables
- DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- SAFEPAY_PUBLIC_KEY, SAFEPAY_PRIVATE_KEY, SAFEPAY_ENV, SAFEPAY_WEBHOOK_SECRET
- CLOUDINARY_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (configured but not wired)
- EMAIL_FROM (configured but no email provider)

---

# 23. Mock / Demo Data Audit

## Seed Data
- **One society:** "Sunrise Apartments" (`backend/prisma/seed.ts`)
- **Two users:** Admin (`admin@sunrise.com` / `admin123`), Resident (`resident@sunrise.com` / `resident123`)
- **Two buildings:** Tower A, Tower B
- **Five units:** A-101, A-102, A-201, B-101, B-102
- **No tickets, invoices, notices, or other operational data seeded**

## Landing Page
- Testimonials are fabricated (Ahmed Raza, Fatima Malik, Usman Khan) - not real users
- Trust bar (Capterra, G2, Trustpilot, Google ratings) is UI-only - no actual review platform integration
- Pricing page references "200+ communities across Pakistan" - unsupported claim
- Hero floating cards show hardcoded amounts ("Rs 84,500", "Visitor approved · Unit 201") - static mockup

## Frontend
- Dashboard pages pull real data from API - not hardcoded
- Guard interface fetches real units from API
- No mock API intercepts or fake data generators in production code

---

# 24. Implementation Completeness

| Area | Status | Confidence | Notes |
|---|---|---|---|
| Authentication & Onboarding | ✅ Complete | High | JWT, signup, login, invite, revoke |
| Building & Unit Management | ✅ Complete | High | Full CRUD with validation |
| Resident Management | ✅ Complete | High | Invite, directory, membership management |
| Notices & Announcements | ✅ Complete | High | CRUD, publish/draft, read receipts |
| Maintenance Ticketing | ✅ Complete | High | Full lifecycle, comments, photos, ratings |
| Invoicing & Payments | ✅ Complete | High | CRUD, Safepay integration, webhooks |
| Amenity Booking | ✅ Complete | High | Conflict detection, configurable rules |
| Visitor & Gate Management | ✅ Complete | High | QR passes, gate logs, auto-revoke |
| Community Polls | ✅ Complete | High | One-vote-per-unit, results visibility |
| Document Storage | ✅ Complete | High | Folder hierarchy, upload/download |
| Parcel Tracking | ✅ Complete | High | Arrival, collection, photo |
| Automated Dues Reminders | ✅ Complete | High | BullMQ job, configurable |
| Vendor Ratings | ✅ Complete | High | Rating + aggregation |
| Analytics Dashboard | ✅ Complete | High | 4 aggregate views |
| Audit Trail | ✅ Complete | High | Every mutation logged, export |
| Email/Push Notifications | ❌ Not Started | High | Stub only |
| Rate Limiting | ❌ Not Started | Medium | Mentioned in plan, not implemented |
| Cloudinary Integration | 🔵 Deferred | High | Env vars configured, code uses local disk |
| Frontend Tests | ❌ Not Started | High | No test files |
| Token Blacklisting | 🔵 Deferred | High | TODO in logout endpoint |

---

# 25. Demo Readiness

## ⭐ MUST DEMO (Strongest product value)

### Demo 1: End-to-End Maintenance Ticket
- **Starting state:** Seed with admin + resident
- **Steps:** Resident login → raise ticket with photo → Admin login → assign vendor → mark In Progress → Close + rate
- **Why impressive:** Shows complete lifecycle, role separation, audit trail
- **Failure point:** Photo upload requires multipart form

### Demo 2: Online Dues Payment
- **Starting state:** Admin creates invoice for resident's unit
- **Steps:** Admin login → create invoice → Resident login → view invoice → click Pay → Safepay checkout → payment confirmed
- **Why impressive:** Real payment gateway integration, webhook-driven confirmation
- **Failure point:** Requires Safepay sandbox credentials configured

### Demo 3: Visitor Management + Gate Access
- **Starting state:** Resident with assigned unit
- **Steps:** Resident creates visitor pass → shares QR token → Guard enters QR → auto-approves → Check-in → Check-out
- **Why impressive:** Multi-role workflow, QR verification, gate logging
- **Failure point:** Guard interface is separate page

## 👍 GOOD TO DEMO

### Demo 4: Admin Dashboard Overview
- Summary cards, attention items, recent tickets - shows operational visibility

### Demo 5: Community Polling
- Admin creates poll → activates → Resident votes → results visible

## ⚠️ DEMO WITH CAUTION

### Demo 6: Analytics Dashboard
- Requires sufficient data to show meaningful charts

## ❌ DO NOT DEMO

- Email notifications (stub only)
- Cloudinary storage (uses local disk)
- Guard "Recent Activity" tab (placeholder)

---

# 26. Pitch-Worthy Features

| # | Feature | Why It Matters | Target User | Problem Solved | Presentation Value |
|---|---|---|---|---|---|
| 1 | QR-Coded Visitor Passes | Modernizes gate security | Admin, Guard, Resident | Phone-call-based gate access | ⭐ Show QR generation + guard scan flow |
| 2 | Online Dues Collection | Eliminates door-to-door collection | Admin, Resident | Manual dues collection | ⭐ Show invoice → payment → confirmation |
| 3 | Maintenance Ticket Lifecycle | Creates accountability | Admin, Resident | Lost WhatsApp requests | ⭐ Show ticket flow with status badges |
| 4 | Complete Audit Trail | Ensures transparency | Admin | No record of actions | Show audit log with before/after |
| 5 | Automated Dues Reminders | Reduces admin workload | Admin | Manual follow-up | Show configurable settings + scheduled job |
| 6 | Role-Based Dashboards | Personalized experience | All | One-size-fits-all tools | Show admin vs resident vs guard interfaces |
| 7 | Community Polls | Enables digital democracy | Admin, Resident | Paper ballots | Show voting + results |
| 8 | Vendor Ratings | Drives vendor accountability | Admin | No vendor performance data | Show rating aggregation |

---

# 27. Screenshot & Visual Asset Recommendations

| Screen | Route | Role | What It Demonstrates | Recommended Purpose |
|---|---|---|---|---|
| Admin Dashboard | `/dashboard/admin` | Committee Admin | Centralized visibility, attention items | Pitch deck hero, standee |
| Resident Dashboard | `/dashboard/resident` | Resident | Quick actions, activity feed | Pitch deck feature slide |
| Guard Interface | `/dashboard/guard` | Security Guard | QR verification, gate actions | Pitch deck security slide |
| Landing Page Hero | `/` | Public | Product positioning, modern design | Website, standee background |
| Ticket Detail | `/dashboard/admin/tickets` | Committee Admin | Status lifecycle, comments, rating | Feature deep-dive |
| Invoice + Payment | `/dashboard/resident/invoices` | Resident | Online payment flow | Finance feature slide |
| Visitor Pass + QR | `/dashboard/resident/visitors` | Resident | QR code generation | Security feature slide |
| Analytics Dashboard | `/dashboard/admin/analytics` | Committee Admin | Charts, metrics | Analytics feature slide |

---

# 28. Business & Product Positioning

| Attribute | Value |
|---|---|
| **Target customer** | Housing society committees, apartment complex management |
| **Target user** | Committee admins, residents, security guards |
| **Core value proposition** | Replace scattered manual processes with one connected, auditable platform |
| **Product category** | Multi-tenant SaaS - Property/Community Management |
| **Primary use case** | Residential society management (Pakistan market) |
| **Secondary use cases** | Gated communities, cooperative housing, student housing |

## Potential Business Models (Not Implemented)
- **Per-community pricing** - monthly subscription per society
- **Per-unit pricing** - fee per managed unit
- **Freemium** - free tier for small societies, paid for advanced features
- **Enterprise licensing** - large multi-society organizations

---

# 29. Competitive Positioning

## Category
The product competes with:
- Manual processes (WhatsApp groups, paper logs, spreadsheets)
- Generic property management software
- Dedicated apartment/community management platforms

## Potential Strengths
- Purpose-built for Pakistani market (PKR currency, local payment gateway)
- Multi-tenant architecture from day one
- Complete audit trail (not just CRUD)
- QR-coded visitor management (unique in this category)
- Role-based interface separation (admin vs resident vs guard)

## Potential Weaknesses
- No mobile app (web-responsive only)
- No email notifications (critical gap)
- No real Cloudinary/S3 storage
- Limited analytics (no custom reports)
- No integrations with accounting software

---

# 30. Business Value

| Technical Feature | Business Outcome |
|---|---|
| Centralized invoice management | Structured dues tracking instead of scattered messages |
| Online payment (Safepay) | Faster collection, automatic reconciliation |
| Maintenance ticketing | Accountability and resolution tracking |
| QR visitor passes | Secure, auditable gate access |
| Audit trail | Transparency for committee transitions |
| Automated reminders | Reduced manual follow-up |
| Analytics dashboard | Data-driven operational decisions |
| Vendor ratings | Informed vendor selection |

---

# 31. Gaps, Risks & Limitations

| Gap | Severity | Impact |
|---|---|---|
| No email/push notifications | HIGH | Users must check the platform manually |
| No rate limiting | HIGH | Auth endpoints vulnerable to brute force |
| CORS wide open | HIGH | Any origin can make authenticated requests |
| Token blacklisting not implemented | MEDIUM | Refresh tokens remain valid after logout |
| No frontend tests | MEDIUM | Frontend regressions undetectable |
| Local file storage only | MEDIUM | Not production-ready, no CDN |
| No search/filter on list pages | MEDIUM | Poor UX with many records |
| Cloudinary not wired | LOW | Env vars present but code uses disk |
| Dead `stripe` dependency | LOW | Unused package in backend |
| Minimal seed data | LOW | Demo requires manual data entry |
| No pagination UI | LOW | All records loaded at once |
| Guard "Recent Activity" placeholder | LOW | Incomplete feature |

---

# 32. Future Roadmap

## Short-Term (Next 1-2 sprints)
- Email notification provider integration (Resend/Postmark)
- Rate limiting on auth endpoints
- CORS restriction for production
- Token blacklisting via Redis
- Frontend form validation with Zod
- Search/filter on list pages

## Medium-Term (1-2 months)
- Cloudinary/S3 file storage integration
- Pagination UI (infinite scroll or load-more)
- Toast/notification system
- Frontend test suite (Vitest + React Testing Library)
- E2E tests (Playwright)
- Native mobile app (React Native or PWA)

## Long-Term (3-6 months)
- AI Layer (Phase 8): pgvector, semantic search, vendor auto-assignment
- Multi-society management for enterprise
- Accounting software integration
- Custom report builder
- White-label support

---

# 33. Verified Facts

| Fact | Evidence |
|---|---|
| 5 user roles defined (SUPER_ADMIN, COMMITTEE_ADMIN, RESIDENT, SECURITY_GUARD, VENDOR) | `shared/src/index.ts`, `backend/src/lib/permissions.ts` |
| 12+ major feature modules implemented | Route files in `backend/src/routes/` |
| 18 database models | `backend/prisma/schema.prisma` |
| Multi-tenant with societyId scoping | `backend/src/db/tenant-scope.ts` |
| JWT auth with access + refresh tokens | `backend/src/lib/auth.ts` |
| Safepay payment gateway integration | `backend/src/lib/payment-provider.ts` |
| BullMQ background job queue | `backend/src/queue/index.ts` |
| 99 automated tests passing | `docs/PROGRESS.md` |
| Prisma ORM with PostgreSQL | `backend/prisma/schema.prisma` |
| Next.js 14 App Router frontend | `frontend/package.json` |
| Tailwind CSS styling | `frontend/tailwind.config.js` |
| Dark mode support | `frontend/src/lib/theme.tsx` |
| Docker Compose for local dev | `docker-compose.yml` |
| Vercel + Railway deployment config | `vercel.json`, `railway.json` |
| Complete audit trail on every mutation | `backend/src/lib/audit.ts` |
| QR-coded visitor passes | `backend/src/routes/visitors.ts` |
| Automated dues reminders via BullMQ | `backend/src/lib/due-reminders.ts` |
| Vendor ratings with aggregation | `backend/src/routes/tickets.ts` GET /vendor-ratings |

---

# 34. Claims We Should NOT Make

| Claim | Reason |
|---|---|
| "Email notifications are built" | Only audit trail + console.log stubs exist |
| "Files are stored securely in the cloud" | Local disk only, Cloudinary not wired |
| "The platform is PCI compliant" | No PCI compliance implementation |
| "200+ communities use OmniHome" | Landing page claim with no evidence |
| "Real user testimonials" | Testimonials are fabricated for design |
| "5-star ratings on Capterra/G2/Trustpilot" | Trust bar is UI-only |
| "Native mobile app available" | Only responsive web |
| "Real-time notifications" | No push/email infrastructure |
| "Automated invoice generation" | Invoices are manually created by admin |
| "Multi-region deployment" | Single-region only |

---

# 35. Elevator Pitch Material

## One-Line Description (~20 words)
> OmniHome is a connected platform that replaces WhatsApp and spreadsheets for managing apartment societies - payments, maintenance, visitors, and governance.

## Short Description (~60 words)
> OmniHome is a multi-tenant SaaS platform for residential community management. It replaces scattered WhatsApp messages and paper logs with centralized tools for dues collection (with online payments), maintenance ticketing, QR-coded visitor management, community polling, document storage, and a complete audit trail - all with role-based dashboards for admins, residents, and security guards.

## Detailed Description (~150 words)
> OmniHome is a full-stack apartment management platform built for housing societies in Pakistan. It provides committee admins with centralized control over buildings, units, residents, maintenance, finances, and security. Residents get a personalized dashboard to raise tickets, pay dues online via Safepay, book amenities, vote in polls, and manage visitor passes with QR codes. Security guards use a purpose-built tablet interface to verify visitors and log gate entry/exit. Every action is recorded in a searchable audit trail, and automated dues reminders reduce manual follow-up. The platform is built on a multi-tenant architecture ensuring complete data isolation between societies, with role-based access control enforcing permissions at every level.

## Problem Statement
> Housing societies manage dozens of daily operations - dues collection, maintenance requests, visitor access, notices - through scattered WhatsApp messages, paper logs, and spreadsheets, leading to lost information, no accountability, and manual overhead.

## Solution Statement
> OmniHome centralizes every community workflow into one connected platform with role-based dashboards, ensuring every action is tracked, every payment is reconciled, and every visitor is verified.

---

# 36. Pitch Deck Intelligence

## Recommended Slide Sequence

1. **Opening Story** - "Every housing society faces the same problem: managing community life through WhatsApp and paper"
2. **Problem** - 4-5 pain points with relatable scenarios
3. **Solution** - OmniHome overview with 3-4 key features
4. **Product Demo** - Screenshots of admin dashboard, resident dashboard, guard interface
5. **Key Features** - QR visitors, online payments, maintenance tracking, audit trail
6. **Architecture** - Multi-tenant, role-based, secure
7. **Market Opportunity** - Pakistan housing society market
8. **Business Model** - Per-community SaaS pricing (proposed)
9. **Roadmap** - Phase 8 AI features as future vision
10. **Team/Closing**

## Strongest Opening Story
> "Imagine a committee admin who spends 3 hours every month chasing residents for maintenance dues, another 2 hours fielding WhatsApp messages about leaking faucets, and has no record of who approved which visitor last week. OmniHome eliminates all of that."

## Features to AVOID Highlighting
- Email notifications (not built)
- Cloudinary storage (not wired)
- AI features (not started)
- Native mobile app (not available)

---

# 37. Standee Intelligence

## Headline Direction
> **"The operating system for residential communities"**

## One-Line Value Proposition
> Replace WhatsApp, paper logs, and spreadsheets with one connected platform for your society.

## Top 5 Features (for standee)
1. QR-Coded Visitor Passes
2. Online Dues Collection
3. Maintenance Ticket Tracking
4. Complete Audit Trail
5. Role-Based Dashboards

## Hero Screenshot
> Admin Dashboard - shows summary cards, attention items, and recent tickets. Demonstrates centralized visibility.

## Technology Badges
> Next.js · Express · PostgreSQL · Safepay · Tailwind CSS

---

# 38. Presentation Intelligence

## 30-Second Explanation
> "OmniHome is a platform for housing societies that replaces WhatsApp and spreadsheets. Admins manage buildings, collect dues online, and track maintenance. Residents raise tickets, pay bills, and create visitor passes with QR codes. Security guards scan QR codes at the gate. Every action is audited."

## 1-Minute Explanation
> "In Pakistan, housing societies manage everything through WhatsApp groups and paper logs. OmniHome is a SaaS platform that centralizes all community operations. Committee admins get a dashboard showing open tickets, pending dues, and attention items. Residents can pay maintenance dues online through Safepay, raise maintenance tickets with photos, book amenities, vote in community polls, and create QR-coded visitor passes. Security guards use a tablet interface to verify visitors at the gate. Every action is recorded in a searchable audit trail, and automated reminders reduce manual follow-up."

## 3-Minute Demo Narrative
> 1. Show landing page - "This is the public face of OmniHome"
> 2. Login as admin - "Committee admin sees a centralized dashboard"
> 3. Create a building and unit - "Setting up the society takes minutes"
> 4. Invite a resident - "One-click resident onboarding"
> 5. Login as resident - "Resident sees their personalized dashboard"
> 6. Raise a maintenance ticket - "Structured complaint tracking"
> 7. Switch to admin - assign vendor, update status - "Full lifecycle management"
> 8. Create an invoice - "Financial management"
> 9. Create a visitor pass - "QR-coded security"
> 10. Show audit trail - "Every action is recorded"

---

# 39. Likely Questions & Evidence-Based Answers

### Product Questions

**Q: How many user roles does the platform support?**
A: 5 roles - SUPER_ADMIN, COMMITTEE_ADMIN, RESIDENT, SECURITY_GUARD, VENDOR. COMMITTEE_ADMIN and RESIDENT are the primary roles. SECURITY_GUARD has a dedicated interface. VENDOR is referenced by name on tickets but has no direct system access.
Confidence: HIGH - `backend/src/lib/permissions.ts`

**Q: Can residents pay maintenance dues online?**
A: Yes, through Safepay hosted checkout. Residents click "Pay" on an invoice, are redirected to Safepay's payment page, and upon completion, a webhook updates the invoice status. If Safepay is not configured, payments fall back to offline mode.
Confidence: HIGH - `backend/src/routes/invoices.ts` POST /:id/pay, `backend/src/routes/payments.ts`

**Q: How does visitor management work?**
A: Residents create visitor passes with visitor details. A QR token is generated. The visitor shows the QR code/token at the gate. The security guard enters it in the guard interface, which verifies the pass and auto-approves if pending. The guard then records check-in and check-out. Passes auto-expire after 24 hours and auto-revoke when a membership is revoked.
Confidence: HIGH - `backend/src/routes/visitors.ts`

### Technical Questions

**Q: How is multi-tenancy enforced?**
A: Every tenant-scoped database query includes a `societyId` filter. The `loadMembership` middleware loads the user's membership for the current society context. The `requireRole` middleware checks permissions against the membership role. The `tenant-scope.ts` module provides repository wrappers that automatically apply societyId filtering.
Confidence: HIGH - `backend/src/db/tenant-scope.ts`, `backend/src/middleware/auth.ts`

**Q: Is the payment integration real?**
A: Yes. Safepay hosted checkout is fully implemented with passport token creation, tracker creation, redirect flow, webhook verification (HMAC-SHA512), and server-side reconciliation fallback. Payments fall back to offline mode when Safepay keys are not configured.
Confidence: HIGH - `backend/src/lib/payment-provider.ts`

**Q: What happens if Redis is down?**
A: The BullMQ queue starts in a safe "disabled" mode. The API keeps working normally. Automated dues reminders don't fire, but admins can trigger them manually via the settings page. This is explicitly handled in the queue module.
Confidence: HIGH - `backend/src/queue/index.ts`

### Security Questions

**Q: How are passwords stored?**
A: Bcrypt with 12 salt rounds. Passwords are never stored in plain text.
Confidence: HIGH - `backend/src/lib/auth.ts`

**Q: Is there an audit trail?**
A: Yes. Every mutating operation (create, update, delete) across all modules writes to an AuditLog table with the actor's ID, action type, entity type, entity ID, and optional before/after JSON snapshots. Audit logs are searchable, filterable, and exportable.
Confidence: HIGH - `backend/src/lib/audit.ts`, `backend/src/routes/audit-log.ts`

### Future Scope Questions

**Q: Is there an AI layer?**
A: Not yet. Phase 8 in the plan includes pgvector for semantic search, vendor auto-assignment suggestions, anomaly detection, and natural-language document queries. This is planned but not started.
Confidence: HIGH - `docs/PLAN.md` Phase 8

**Q: Is there a mobile app?**
A: Not yet. The web application is fully responsive and works on mobile browsers. A native mobile app is mentioned in the landing page FAQ as a future plan but is not implemented.
Confidence: HIGH - responsive design in all frontend files

---

# 40. Final Recommendations

1. **Add email notifications** - This is the highest-impact missing feature. Without it, users must actively check the platform.
2. **Restrict CORS for production** - The current `origin: true` setting allows any origin.
3. **Implement rate limiting** - Protect auth endpoints from brute force attacks.
4. **Wire up Cloudinary** - The env vars are configured; the code just needs to use the SDK instead of local disk.
5. **Add frontend tests** - Zero frontend test coverage is a significant gap.
6. **Extract duplicated helpers** - `getUserUnitIds` is copy-pasted across 4 route files.
7. **Remove dead `stripe` dependency** - The project uses Safepay; Stripe is unused.
8. **Enhance seed data** - Add sample tickets, invoices, notices for better demo experience.
9. **Add search/filter to list pages** - Tickets, visitors, parcels, and other lists need filtering.
10. **Add pagination UI** - The API supports cursor-based pagination; the frontend doesn't use it.

---

# 41. Project At a Glance

| Category | Finding |
|---|---|
| **Product** | OmniHome - Multi-tenant SaaS for residential community management |
| **Target Users** | Housing society committee admins, residents, security guards |
| **Core Problem** | Community operations managed through WhatsApp, paper logs, spreadsheets |
| **Core Solution** | One connected platform with role-based dashboards and complete audit trail |
| **Main Features** | Maintenance ticketing, online payments, visitor QR passes, notices, polls, amenities, documents, parcels, analytics |
| **User Roles** | 5 roles (SUPER_ADMIN, COMMITTEE_ADMIN, RESIDENT, SECURITY_GUARD, VENDOR) |
| **Tech Stack** | Next.js 14 + Express.js + Prisma + PostgreSQL + Redis + BullMQ + Tailwind CSS |
| **Database** | PostgreSQL with 18 models, multi-tenant via societyId scoping |
| **Authentication** | Custom JWT (access + refresh) with httpOnly cookies |
| **Integrations** | Safepay (payments), BullMQ (background jobs) |
| **Strongest Feature** | QR-coded visitor management with gate logging |
| **Strongest Differentiator** | Complete audit trail as infrastructure + multi-tenant architectural isolation |
| **Biggest Limitation** | No email/push notifications, no cloud file storage |
| **Demo Recommendation** | Maintenance ticket lifecycle + online payment + visitor QR flow |
| **Pitch Recommendation** | Lead with the "WhatsApp replacement" narrative, show admin dashboard + guard interface |

---

# Appendix A - Evidence Index

| Finding | Evidence | Confidence |
|---|---|---|
| Society onboarding creates Society+User+Membership atomically | `backend/src/routes/auth.ts` POST /signup (Prisma transaction) | High |
| Multi-tenancy enforced via societyId | `backend/src/db/tenant-scope.ts`, all route handlers | High |
| RBAC with 5-role permission matrix | `backend/src/lib/permissions.ts` (PERMISSION_MATRIX) | High |
| JWT auth with access+refresh tokens | `backend/src/lib/auth.ts`, `backend/src/middleware/auth.ts` | High |
| Safepay hosted checkout integration | `backend/src/lib/payment-provider.ts` (SafepayPaymentProvider) | High |
| Webhook signature verification (HMAC-SHA512) | `backend/src/lib/payment-provider.ts` verifyWebhookSignature() | High |
| BullMQ scheduled job for dues reminders | `backend/src/queue/index.ts` (startReminderQueue) | High |
| QR token generation for visitor passes | `backend/src/routes/visitors.ts` generateQrToken() | High |
| Gate entry/exit logging | `backend/src/routes/visitors.ts` POST /:id/gate | High |
| One-vote-per-unit enforcement | `backend/src/prisma/schema.prisma` Vote model @@unique([pollId, unitId]) | High |
| Audit logging on every mutation | `backend/src/lib/audit.ts` logAudit(), used in all route files | High |
| Vendor rating aggregation | `backend/src/routes/tickets.ts` GET /vendor-ratings | High |
| 99 automated tests passing | `docs/PROGRESS.md` Phase 7 Slice 4 | High |
| Soft-delete pattern | All tenant-scoped models have `deletedAt DateTime?` | High |
| File uploads via multer (local disk) | `backend/src/routes/documents.ts`, `tickets.ts`, `parcels.ts` | High |
| Dark mode support | `frontend/src/lib/theme.tsx` ThemeProvider | High |
| Mobile bottom navigation | `frontend/src/components/dashboard/resident-shell.tsx` | High |
| Guard tablet-friendly interface | `frontend/src/app/dashboard/guard/page.tsx` | High |

---

# Appendix B - Important Files

## Backend
| File | Significance |
|---|---|
| `backend/prisma/schema.prisma` | Complete data model (18 entities, all enums, indexes) |
| `backend/src/app.ts` | Express app setup, all route registration |
| `backend/src/middleware/auth.ts` | JWT verification, membership loading |
| `backend/src/middleware/rbac.ts` | Role-based access control middleware |
| `backend/src/lib/permissions.ts` | Complete permission matrix |
| `backend/src/lib/auth.ts` | JWT signing/verification, password hashing |
| `backend/src/lib/payment-provider.ts` | Safepay integration with PaymentProvider abstraction |
| `backend/src/lib/due-reminders.ts` | Automated reminder selection logic |
| `backend/src/lib/audit.ts` | Audit trail logging |
| `backend/src/lib/notifications.ts` | Notification stubs (audit trail only) |
| `backend/src/db/tenant-scope.ts` | Multi-tenant query scoping |
| `backend/src/queue/index.ts` | BullMQ worker for scheduled jobs |
| `backend/src/routes/auth.ts` | Authentication, signup, login, invite |
| `backend/src/routes/tickets.ts` | Maintenance ticketing + vendor ratings |
| `backend/src/routes/invoices.ts` | Invoicing + payment initiation |
| `backend/src/routes/payments.ts` | Payment webhook + verification |
| `backend/src/routes/visitors.ts` | Visitor passes + gate management |
| `backend/src/routes/analytics.ts` | Admin analytics aggregation |
| `backend/prisma/seed.ts` | Demo data seed script |

## Frontend
| File | Significance |
|---|---|
| `frontend/src/app/page.tsx` | Landing page (marketing, features, pricing, FAQ) |
| `frontend/src/app/login/page.tsx` | Login page with test credentials display |
| `frontend/src/app/signup/page.tsx` | Society onboarding form |
| `frontend/src/app/dashboard/admin/page.tsx` | Admin dashboard with summary cards |
| `frontend/src/app/dashboard/resident/page.tsx` | Resident dashboard with quick actions |
| `frontend/src/app/dashboard/guard/page.tsx` | Guard interface (QR scan, parcels) |
| `frontend/src/components/dashboard/admin-shell.tsx` | Admin layout with sidebar navigation |
| `frontend/src/components/dashboard/resident-shell.tsx` | Resident layout with bottom nav |
| `frontend/src/lib/api.ts` | API client with token refresh |
| `frontend/src/lib/theme.tsx` | Dark mode theme provider |

## Shared
| File | Significance |
|---|---|
| `shared/src/index.ts` | All shared types, Zod schemas, response interfaces |

## Configuration
| File | Significance |
|---|---|
| `docker-compose.yml` | Postgres + Redis local dev setup |
| `backend/.env.example` | All required environment variables |
| `vercel.json` | Frontend deployment config |
| `railway.json` | Backend deployment config |

## Documentation
| File | Significance |
|---|---|
| `docs/PLAN.md` | Architecture, conventions, phased build plan |
| `docs/PROGRESS.md` | Build log with per-slice completion status |
| `docs/AGENTS.md` | AI agent operating manual |

---

# Appendix C - Unresolved Questions

| Question | Why It Matters | Evidence Missing |
|---|---|---|
| Which email provider will be used? | Critical for notification delivery | `docs/PLAN.md` lists Resend/Postmark/SES as options, none selected |
| Will Cloudinary or S3 be used for production storage? | Impacts deployment and file serving | Cloudinary env vars present but code uses local disk |
| What is the production CORS policy? | Security impact | Currently `origin: true` (allows all) |
| Will rate limiting be Redis-based? | Security impact | PLAN.md mentions Redis-backed limiter but not implemented |
| What is the planned pricing model? | Business model | Landing page shows Starter/Pro/Enterprise tiers but no backend implementation |
| Are there real user testimonials? | Marketing credibility | Testimonials appear fabricated for design purposes |
| Is "200+ communities" a real metric? | Marketing credibility | No evidence in codebase |
| Will the VENDOR role get a self-service portal? | Product scope | PLAN.md mentions "may not need full account in MVP" |
