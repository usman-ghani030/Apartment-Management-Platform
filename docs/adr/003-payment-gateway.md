# ADR 003: Payment Gateway

**Status**: Accepted
**Date**: 2026-07-19 (supersedes the original Stripe choice in the tech stack; no Stripe integration was ever built, so this is a clean switch, not a migration)

## Context
Need online dues/invoice collection for residents. Stripe was the original placeholder choice in the tech stack, but Safepay is a better fit for this market (Pakistan-focused payment gateway, local payment method support) and sandbox keys are already provisioned.

## Decision
- **Provider**: Safepay, sandbox/test keys for now, to be swapped for live keys when ready to accept real payments (a config change only, not a code change).
- **Checkout flow**: Safepay's hosted checkout (redirect flow) rather than an embedded/inline integration. Reasons: Safepay handles PCI compliance and card data entirely on their hosted page, meaningfully less code and attack surface than embedding a payment form directly, and it's the faster path to a working, secure integration for a solo-developer timeline.
- **Abstraction**: implemented behind a `PaymentProvider` interface (`createCheckoutSession(invoice)`, `handleWebhook(payload, signature)`, `verifyPayment(sessionId)`), mirroring the `StorageProvider` pattern from ADR 002. No feature code calls the Safepay SDK directly — this keeps a future provider swap (or adding a second provider for a different market) a contained change.
- **Scope for this pass**: dues/maintenance invoice payments only — not amenity booking fees or other one-off payments, which can be added later without changing this abstraction.

## Alternatives Considered
- **Embedded checkout**: gives more control over UI/branding, but significantly more implementation and compliance surface (handling card data flows, stricter PCI scope) for limited benefit at this stage — hosted checkout can be revisited later if the redirect UX becomes a real friction point.
- **Stripe**: better global documentation/ecosystem, but weaker fit for the primary market and no integration work had started, so switching now costs nothing.

## Consequences
- Checkout UX involves a redirect away from the app and back — acceptable tradeoff for reduced complexity and compliance burden; the return/callback flow after payment needs clear success/failure states in the app.
- Webhook endpoint must be publicly reachable (already true, since backend is live on Railway) and Safepay's webhook signature must be verified on every incoming request — never trust an unverified webhook payload to mark an invoice paid.
- If a second market/region later needs a different provider, the `PaymentProvider` interface is the extension point — implement a second provider behind the same interface rather than branching payment logic throughout the codebase.