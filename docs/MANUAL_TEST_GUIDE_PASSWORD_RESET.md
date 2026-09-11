# Manual Test Guide: Password Reset

> You need **real email delivery** to verify the happy path — the reset link only exists inside the emailed message.

## Prerequisites (do this once)

1. **Get a Resend API key**: sign up at https://resend.com → Dashboard → **API Keys** → *Create API Key* → copy the `re_...` value.
2. **Decide how to send**:
   - **Option A — Resend sandbox (easiest)**: no domain needed. Set in `backend/.env`:
     ```
     RESEND_API_KEY=re_...
     EMAIL_FROM="OmniHome <onboarding@resend.dev>"
     ```
     The sandbox only delivers to **the inbox of the email address you signed up to Resend with** — use that address as the test account below.
   - **Option B — your own domain**: add a domain in Resend (Dashboard → Domains → Add Domain → add the DNS records), verify it, then set `EMAIL_FROM` to an address on it (e.g. `noreply@luxesociety.com`).
3. Restart the backend so the new env vars load:
   ```bash
   docker restart apartment-backend
   ```
4. Check the login page has a **"Forgot password?"** link under the password field (it links to `/forgot-password`).

---

## Scenario 1 — Normal password account: full reset flow

Prerequisites: a password account you own, e.g. the seeded `admin@sunrise.com` (password `admin123`) — or a test account on your Resend-verified inbox.

1. Go to `http://localhost:3000/login` → click **"Forgot password?"**
2. Enter the account's email (e.g. `admin@sunrise.com`) and click **Send reset link**
3. Expected: a neutral message — *"If an account exists for this email, a reset link has been sent."* (same message for every email, on purpose)
4. Open the inbox for that email. Expected: a message from OmniHome with subject **"Reset your OmniHome password"**, containing a **Reset my password** button
5. Hover the button / copy the link. Expected: a URL like `http://localhost:3000/reset-password?token=<long-random-string>`
6. Open that link → the **"Set a new password"** page
7. Enter a new password twice (at least 8 characters, they must match) → **Reset password**
8. Expected: green *"Your password has been reset. You can now sign in with your new password."* with a **Back to sign in** button
9. Sign in with the **new** password → dashboard loads
10. Try signing in with the **old** password → *"Invalid email or password"*

## Scenario 2 — The reset link is single-use

1. Repeat Scenario 1 up to step 7, but this time after resetting, go back and open the **same email link again**
2. Expected: *"This reset link has already been used. Please request a new one."*
3. Check the DB for proof:
   ```bash
   docker exec apartment-postgres psql -U postgres -d apartment_management -c 'select "usedAt" from "PasswordResetToken";'
   ```
   The row for your token has a non-null `usedAt`.

## Scenario 3 — Expired token is rejected

1. In `backend/.env`, set `PASSWORD_RESET_TOKEN_TTL_MINUTES=1` and restart the backend
2. Request a reset link (Scenario 1 steps 1–2), then **wait ~2 minutes** before opening the link
3. Expected: *"This reset link has expired. Please request a new one."*
4. Set `PASSWORD_RESET_TOKEN_TTL_MINUTES=60` back and restart

## Scenario 4 — Google-only account gets the *different* email

Prerequisites: an account that signed up with Google (has no password), e.g. the one from the Google Sign-In manual test guide.

1. On `/forgot-password`, enter the **Google-only account's email** and submit
2. Expected: the same neutral *"If an account exists..."* message — no hint about the account type
3. Check the inbox. Expected: subject **"Your OmniHome account uses Google Sign-In"** — the body explains there is no password to reset and offers a **"Sign in with Google"** button. **There is no reset link in it.**
4. Confirm no token was created:
   ```bash
   docker exec apartment-postgres psql -U postgres -d apartment_management -c "select count(*) from \"PasswordResetToken\" t join \"User\" u on u.id = t.\"userId\" where u.email = '<google-only-email>';"
   ```
   Expected: `0`.

## Scenario 5 — Unknown email does NOT reveal existence

1. On `/forgot-password`, enter an email that has **no account** (e.g. `definitely-not-registered@example.com`) and submit
2. Expected: the **exact same** *"If an account exists for this email, a reset link has been sent."* message as Scenario 1
3. Expected: **no email arrives** in any inbox, and no row appears in `PasswordResetToken`

## Scenario 6 — Reset logs out other sessions (tokenVersion)

Prerequisites: two browsers (or normal + incognito), both signed in as the same user.

1. In browser A and incognito B, sign in as `admin@sunrise.com`
2. In incognito B, do the full reset flow (Scenario 1) and sign in with the new password
3. Back in browser A, try to navigate / refresh a dashboard page
4. Expected: browser A gets logged out (its refresh token is now invalid — API returns 401, you land back at login). Only the session that reset the password survives.

## Scenario 7 — Rate limiting kicks in

1. In a terminal, fire 6 quick requests for the same email:
   ```bash
   for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/v1/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"spam@example.com"}'; done
   ```
2. Expected: five `200`s, then a `429` with `{"error":{"code":"RATE_LIMITED",...}}`
3. The limit resets after 15 minutes.

---

## If something looks wrong

- **No email arrives at all**: check `docker logs apartment-backend` for a line like `[EMAIL] to=... (no RESEND_API_KEY — not delivered)` → the key isn't loaded (restart after editing `backend/.env`). If you see `Resend delivery failed`, check the sandbox rule (Option A only sends to your own Resend inbox) or domain verification (Option B).
- **Reset link page says the link is invalid immediately**: make sure you opened the URL from the email (it contains `?token=...`), not just `/reset-password`.
- **Google-only email never arrives**: same env checks as above — the endpoint still returns the neutral 200 even if delivery failed (by design).
- **Anything else**: open DevTools → Network → look at the `forgot-password` / `reset-password` request and response, and send the JSON back with your report.