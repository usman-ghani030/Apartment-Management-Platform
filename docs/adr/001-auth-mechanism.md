# ADR 001: Authentication Mechanism

## Context and Problem Statement
We need an authentication and session management mechanism for a multi-tenant residential community management platform. Since a single `User` can have multiple `Membership` roles/records across different `Society` tenants (e.g. resident in one society, committee admin in another, or owning multiple units), the system needs to support clean tenant-isolated lookup and role verification based on active session states.

## Decision
We will roll our own session authentication using standard `bcryptjs` for password hashing and custom JSON Web Tokens (JWT) signed by a server-side secret.

### Why this approach?
1. **Direct Tenant Control**: It allows us to embed clean, multi-tenant session payloads (e.g., active membership profiles) directly within the JWT or session query, ensuring we can enforce `societyId` scoping securely without relying on third-party API limits or synchronization issues.
2. **Minimal External Dependencies**: It removes dependencies on external services like Clerk or Auth0, saving budget and eliminating potential latency or external service downtime.
3. **Cookie-Based Security**: Tokens will be stored inside HTTP-Only, Secure, SameSite cookies to protect against Cross-Site Scripting (XSS) attacks.
4. **Token Control**: Access token payload carries only `userId` (never role/societyId, since those must reflect live `Membership` state, not a stale token). Refresh tokens are stored in Redis (revocable) for auto-revoking moved-out residents.

## Alternatives Considered
- **Clerk / Auth0**: Dismissed due to multi-tenant routing constraints (e.g. dynamic subdomain checks and multiple memberships per user profile are difficult to configure/sync within basic Clerk tiers) and cost at scale.
- **BetterAuth**: Good alternative, but a custom JWT implementation keeps the Express + Next.js stack clean and explicitly visible to the developers/agents during early implementation.

## Consequences
- We must build the signup, login, session validation, and password reset flows manually in Phase 0.
- We must ensure correct security measures (HTTP-only cookies, robust JWT signing, token blacklist via Redis for logout operations).
