# ADR 004: Email Delivery Provider

**Status**: Accepted
**Date**: 2026-07-19 (supersedes Resend, which had unresolved delivery issues after initial integration)

## Context
Password reset (and other transactional email: notices, ticket status, dues reminders, vendor assignment) needs reliable email delivery. Resend was the first choice but did not work as expected in practice. This is the second provider choice for this project (after the Stripe → Safepay switch for payments) — worth building the abstraction this time rather than repeating the direct-integration mistake.

## Decision
- **Provider**: Nodemailer as the sending library, configured to use Gmail SMTP (the developer's existing Gmail account + an App Password) as the transport.
- **Abstraction**: implemented behind an `EmailProvider` interface (`sendEmail({ to, subject, html, text })` at minimum), mirroring `StorageProvider` (ADR 002) and `PaymentProvider` (ADR 003). No feature code calls Nodemailer or constructs SMTP transport details directly — every email-sending feature (password reset, notices, ticket updates, dues reminders, vendor assignment) goes through this one interface.
- **Known limitation, accepted for now**: Gmail SMTP has a daily sending cap (~500/day on a standard account) and is not designed for transactional email at scale — Google may throttle or flag automated sending patterns. This is acceptable for current volume but is explicitly NOT a permanent production decision.

## Alternatives Considered
- **Resend** (previous choice): abandoned due to delivery issues encountered during integration; not diagnosed in depth since Gmail SMTP was a faster path to something working.
- **A dedicated transactional provider** (SendGrid, Brevo, Postmark): better fit for production-scale, reliable delivery, and sender reputation — but adds account setup overhead not justified while sending volume is low and time is a constraint.

## Consequences
- The `EmailProvider` abstraction means switching away from Gmail SMTP later (to a dedicated provider, once volume or deliverability demands it) is a contained change — implement a new provider behind the same interface, swap the instantiation, done. No feature code needs to change.
- Revisit this decision once: (a) daily email volume approaches Gmail's sending cap, (b) any deliverability issues appear (emails landing in spam, delayed delivery), or (c) the app has enough real users that email reliability becomes business-critical rather than a development convenience.
- Add a short note to `docs/PROGRESS.md` when this is revisited so future sessions know this was always meant to be temporary.