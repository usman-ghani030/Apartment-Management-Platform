# AGENTS.md — Operating Manual for AI Coding Agents

> This file governs how any AI coding agent (Claude Code, opencode, antigravity, or any other CLI/agent tool) must operate in this repository. Read this **and** `docs/PLAN.md` fully before writing any code. If instructions here ever conflict with a request typed in the moment, follow this file unless the human explicitly overrides it in that conversation.
>
> The human maintainer is a solo developer directing multiple different AI agent tools across sessions. This file exists so that *any* agent, on *any* day, behaves consistently — like picking up work from a disciplined teammate, not starting fresh each time.

---

## 1. Golden Rules

1. **Follow `docs/PLAN.md` phase order exactly.** Do not build Phase 2 features while "in" Phase 1. Do not add later-phase entities to the schema early "while you're in there."
2. **Work in vertical slices, one at a time.** A slice = one feature, end-to-end (DB → API → UI), fully working and tested before the next slice starts.
3. **Never invent scope.** If something feels missing from the plan, flag it in your response and propose an addition to `PLAN.md` — don't silently build it.
4. **Never commit secrets.** All credentials live in `.env` files, which are git-ignored. See Section 6.
5. **Never run destructive commands without explicit confirmation** (see Section 8) — this includes `prisma migrate reset`, `git push --force`, dropping databases/tables, deleting migration files, or overwriting `.env`.
6. **Test before declaring done.** No slice or phase is complete until it has been tested per Section 4 — automated where possible, and confirmed by the human manually per the guide you produce.
7. **When you hit an error, fix it — don't work around it or suppress it.** See Section 5.
8. **When you need something only the human can do** (API keys, DB credentials, third-party dashboard setup), stop and ask clearly, step by step, per Section 7 — don't guess, don't stub silently and move on without flagging it.

---

## 2. Step-by-Step Working Process (per phase / per slice)

For every phase in `PLAN.md`, work through it in this order — do not skip steps or reorder them:

**Step A — Plan the slice.** Before writing code, state in your response: which slice you're building, which files/entities it touches, and confirm it matches the current phase in `PLAN.md`. If the schema needs to change, do that first (Section 2 of PLAN.md: schema-first).

**Step B — Build end-to-end.** DB (schema/migration) → API (route + validation + tenant scoping + audit log) → Frontend (UI wired to the real API, not mocked data) for that one slice only.

**Step C — Write automated tests for the slice** (see Section 4.1).

**Step D — Run the full test suite**, not just the new tests, to catch regressions. Resolve any failures per Section 5 before moving on.

**Step E — Produce a manual test guide for the human** (see Section 4.2) — every slice gets one, not just the end of a phase.

**Step F — Update `docs/PROGRESS.md`** (see Section 9) marking the slice complete, and note anything deferred or worth revisiting.

**Step G — Only after all slices in the current phase are done:** run the full regression suite, produce the **end-of-phase test guide** (Section 4.3), and explicitly tell the human the phase is ready for review before starting the next phase.

Do not start the next phase until the human has confirmed the current phase works.

---

## 3. Definition of Done (applies to every slice)

A slice is NOT done until all of the following are true:
- [ ] Code follows conventions in `PLAN.md` Section 14 (naming, response envelope, tenant scoping, audit logging, Zod validation)
- [ ] TypeScript compiles with no errors, strict mode respected, no unexplained `any`
- [ ] Automated tests written and passing
- [ ] Full test suite passing (no regressions)
- [ ] `.env.example` updated if new env vars were introduced
- [ ] `docs/PROGRESS.md` updated
- [ ] Manual test steps written out for the human
- [ ] No secrets, API keys, or credentials committed anywhere in the diff

---

## 4. Testing Protocol

### 4.1 Automated tests (agent-run, every slice)
- Backend: unit tests for business logic (e.g. permission checks, tenant scoping, validation), integration tests for API routes hitting a real test database.
- Frontend: component tests for anything with real logic (forms, conditional rendering by role); skip trivial presentational components.
- Test runner: Vitest (fast, TS-native, works for both frontend and backend). Agents should scaffold this in Phase 0 if not already present.
- Run the relevant test command yourself before reporting a slice as done. Do not ask the human to run tests to discover failures you could have caught.

### 4.2 Manual test guide (per slice) — write this for the human every time
Format, always:
```
### Manual test: <slice name>
Prerequisites: <anything that must be running/seeded first>
1. <exact step, e.g. "Go to localhost:3000/signup">
2. <exact step, e.g. "Enter a test email and society name, submit">
3. Expected result: <what they should see>
...
If something looks wrong: <what to check / what info to send back to the agent>
```
Keep steps concrete and clickable — assume the human is testing quickly between other work, not debugging.

### 4.3 End-of-phase test guide
In addition to per-slice guides, at the end of each phase produce one consolidated walkthrough that exercises the phase's features together (e.g. for Phase 1: post a notice → confirm resident sees it → raise a ticket → move it through statuses → confirm audit log recorded each action). This is what confirms the phase as a whole, not just its parts in isolation.

---

## 5. Error Handling Protocol

- When a command fails or a test fails, **read the actual error output**, form a specific hypothesis, and fix it — don't retry blindly or comment out failing tests/code to "make it pass."
- Fix errors **one at a time**, re-running tests after each fix, rather than making a pile of speculative changes at once — this keeps it possible to tell what actually fixed the problem.
- If the same error persists after **3 genuinely different fix attempts**, stop and report to the human: what you tried, what happened each time, and your best hypothesis for what's needed next (including if it needs a human decision, e.g. a schema/design change).
- Never silently swallow an error (empty catch blocks, ignored promise rejections) to make output "look clean."

---

## 6. Secrets & Environment Variables

- All secrets (DB credentials, JWT secret, Stripe keys, storage provider keys, email provider keys) live in `.env` files at the relevant app root (`backend/.env`, `frontend/.env.local`).
- `.env*` files (except `.env.example`) are git-ignored — verify `.gitignore` covers this in Phase 0 and never override it.
- `.env.example` lists every required variable with a placeholder value and a one-line comment on where to get it — kept up to date every time a slice introduces a new variable. This is the checklist the human uses when setting up or rotating credentials.
- Code reads secrets only via `process.env`, validated at startup (fail fast with a clear message if a required var is missing) — never hardcoded, never logged.

---

## 7. Human-in-the-Loop: When the Agent Needs You

Whenever a task needs something only the human can do — creating an account, generating an API key, setting up a database, connecting a third-party service — the agent stops and gives **explicit, numbered, copy-pasteable steps**, in this format:

```
🔑 ACTION REQUIRED FROM YOU
Why: <one line — what this unlocks>
1. Go to <exact URL>
2. <exact click-by-click step>
3. Copy the value labeled "<exact field name>"
4. Paste it into backend/.env as: KEY_NAME=<value>
5. Tell me once done and I'll continue.
```

Examples of what always triggers this:
- Setting up local Postgres/Redis (docker-compose commands to run, how to verify they're up)
- Creating a Stripe account / test API keys
- Choosing and setting up Cloudinary or AWS S3, generating access keys
- Any OAuth app registration (if auth provider needs it)
- Setting up an email provider (Resend/Postmark/SES) and its API key
- Anything requiring a credit card, phone verification, or account ownership

The agent should **never fabricate a placeholder secret and continue as if it were real** — it should stub the integration behind a clear `TODO: requires human-provided key` and tell the human directly, so nothing silently "half-works."

---

## 8. Git & Command Guardrails

- Commit per slice, with messages formatted: `[Phase N] <slice name>: <what changed>`
- Never `git push --force` without explicit human instruction in that session.
- Never run `prisma migrate reset`, `DROP TABLE`, `DROP DATABASE`, or delete existing migration files without explicit confirmation first — these are irreversible against real data.
- Never delete or rewrite `docs/PLAN.md`, `docs/AGENTS.md`, or `docs/PROGRESS.md` wholesale — edit them incrementally, and only append/adjust the relevant section.

---

## 9. Progress Tracking — `docs/PROGRESS.md`

Since different agent tools (Claude Code, opencode, antigravity) may pick up work across sessions, maintain `docs/PROGRESS.md` as a running log so any agent can resume with full context:

```markdown
## Phase 0 — Foundation
- [x] npm workspaces scaffold (frontend, backend, shared) — done 2026-07-20
- [x] Prisma schema (Society, Building, Unit, User, Membership, AuditLog) — done 2026-07-20
- [ ] Tenant-scoping middleware — in progress, blocked on: <reason if any>
...
Notes for next session: <anything a fresh agent needs to know, e.g. "auth uses BetterAuth, decided in ADR-001">
```

Every agent session starts by reading this file, not just `PLAN.md`, to know exactly where the build stands.

---

## 10. Communication Style (agent → human)

- Be concrete, not vague. "Updated the ticket API" is not useful; "Added POST /api/v1/tickets, GET /api/v1/tickets/:id, tenant-scoped, tested" is.
- Always end a slice/phase report with: what was built, what was tested, what the human should manually check (link to the guide from Section 4.2/4.3), and what's next.
- If you made a judgment call not explicitly covered by `PLAN.md` or this file, say so explicitly rather than burying it — the human should never discover a silent decision later.

---

## 11. Additional Recommendations (optimizations beyond what was asked)

- **ADRs for real decisions.** Any non-obvious technical choice (auth library, storage provider, job queue pattern) gets a short file in `docs/adr/NNN-title.md`: context, decision, alternatives considered, consequences. Future agents should check this folder before re-litigating a decision.
- **Seed data discipline.** Keep `backend/prisma` seed script current every phase so a fresh clone + `npm run db:seed` gives a working demo state for manual testing — don't let it rot after Phase 0.
- **One "smoke test" script** (`npm run smoke`) that hits the critical path end-to-end (signup → invite resident → create ticket) — run this after every phase as a fast sanity check before the deeper manual walkthrough.
- **Changelog discipline.** Every phase completion gets one entry in `PLAN.md`'s Change Log — keeps the plan and reality traceable over a long solo build.
- **Don't auto-upgrade dependencies mid-phase.** Dependency bumps are their own small task, done deliberately, not as a side effect of an unrelated slice.

---

## 12. Code Quality & Formatting

- ESLint + Prettier configured at the repo root in Phase 0, shared config across `frontend` and `backend` — do not let individual slices introduce their own formatting rules or ignore the shared config.
- Husky + lint-staged: pre-commit hook runs lint + format on staged files. Set this up in Phase 0 so it's never optional across different agent tools/sessions.
- A slice is not done if `npm run lint` fails — treat lint errors with the same seriousness as test failures (Section 5).

## 13. Handling Ambiguity (when a human decision is NOT actually needed)

Not every gap in the spec requires stopping and asking (that's reserved for things only the human can *do*, per Section 7). For ordinary implementation ambiguity — e.g. exact wording of an error message, minor field ordering, a reasonable default value:
- Make the most sensible choice consistent with existing conventions in `PLAN.md` and prior slices.
- State the assumption explicitly in your slice report (Section 10) so the human can correct it later if wrong — don't silently decide and stay quiet about it.
- Reserve actually stopping mid-task for cases where the wrong guess would be expensive to undo (schema shape, auth mechanism, a security-relevant default) — those get flagged *before* building, not after.

## 14. Security Checklist (beyond secrets)

Applies from Phase 0 onward, checked as part of Definition of Done for any slice touching data input or external calls:
- All Prisma queries use the query builder, not raw SQL, unless a raw query is unavoidable — if it is, parameters must be bound (never string-interpolated) and the reason documented inline.
- All user-supplied content rendered in the frontend is treated as untrusted (React escapes by default — never use `dangerouslySetInnerHTML` on user content without explicit sanitization).
- File uploads (ticket photos, documents) validate type and size server-side, not just in the UI.
- Dependencies: run `npm audit` at the end of each phase (not per slice) and flag high/critical vulnerabilities to the human rather than silently upgrading a package that might break something.
- Rate limiting (via the Redis-backed limiter from PLAN.md Section 5) applies to all auth and payment-related endpoints at minimum.

## 15. Keeping This File Current

`AGENTS.md` and `PLAN.md` are living documents, but neither should be silently rewritten by an agent mid-task. If an agent discovers a better practice or a rule here that doesn't fit reality once real work starts:
- Propose the change explicitly in the response ("I'd suggest updating AGENTS.md Section X to say Y, because Z") rather than just acting differently and leaving the doc stale.
- Only edit this file directly when the human confirms, then log it in `PLAN.md`'s Change Log (both docs share one change log for simplicity).

## 16. Self-Rating

**9.5/10.**

The remaining 0.5 is deliberately not closed by more writing: things like the exact "3 failed attempts" threshold in Section 5, or whether the manual-test-guide format needs tweaking, are calibration questions that only real usage across a phase or two can answer well. Section 15 exists specifically so those refinements happen as informed, explicit updates once you've seen how your actual agent tools behave — not as guesses baked in now that might not match reality.