# Manual Test Guide: Password Reset (Nodemailer over Gmail SMTP)

> Email is sent through the `EmailProvider` abstraction using **Gmail SMTP** (ADR 004). You need **real email delivery** to verify the happy path — the reset link only exists inside the delivered message.
>
> Unlike the old Resend sandbox, Gmail SMTP can send to **any** address, so you are not limited to one inbox.

## Prerequisites (do this once)

1. **Create a Gmail App Password** — the normal account password will NOT work over SMTP.
   - Go to https://myaccount.google.com/apppasswords (requires 2-Step Verification to be on)
   - Create an app password, copy the 16-character value
2. In `backend/.env` set:
   ```
   GMAIL_USER="you@gmail.com"
   GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
   ```
   (The sender address is `GMAIL_USER` — Gmail requires From to match the authenticated account.)
3. Restart the backend so the env loads:
   ```bash
   docker restart apartment-backend
   ```
4. Sanity-check the transport in isolation (sends a real email to yourself):
   ```bash
   docker exec apartment-backend node -e "const p=process.env;console.log('GMAIL_USER set:', !!p.GMAIL_USER, '| APP_PASSWORD set:', !!p.GMAIL_APP_PASSWORD)"
   ```
   Both should print `true`.
5. Confirm the backend port matches the frontend's API URL — it should be **4000** (`.env.example`, `docker-compose.yml`'s `4000:4000`, and `api.ts`'s default all agree on 4000). Check with `grep '^PORT=' backend/.env` and `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/api/v1/auth/login`. Check the login page has a **"Forgot password?"** link under the password field.

---

## Scenario 1 — Normal password account: full reset flow (the main test)

Prerequisites: a password account whose inbox you can open, e.g. the seeded `admin@sunrise.com` (password `admin123`) — or invite/create a test account with your own Gmail address.

1. Go to `http://localhost:3000/login` → click **"Forgot password?"**
2. Enter the account's email and click **Send reset link**
3. Expected on screen: a **green** banner — *"A password reset link has been sent to your email. Check your inbox."*
4. **Open the inbox** for that address (also check Spam/Promotions — first sends from a Gmail sender often land in Spam). Expected: a message from your Gmail address with subject **"Reset your OmniHome password"**, containing a **Reset my password** button.
5. Hover/copy the button link. Expected: `http://localhost:3000/reset-password?token=<long-random-string>`
6. Open that link → the **"Set a new password"** page
7. Enter a new password twice (≥ 8 chars, must match) → **Reset password**
8. Expected: green *"Your password has been reset. You can now sign in with your new password."* with a **Back to sign in** button
9. Sign in with the **new** password → dashboard loads
10. Sign in with the **old** password → *"Invalid email or password"*

> If the email never arrives, see "If something looks wrong" at the bottom — do **not** skip this, the whole point of this rebuild is real delivery.

## Scenario 2 — The reset link is single-use

1. Repeat Scenario 1 up to step 7, then open the **same email link again**
2. Expected: *"This reset link has already been used. Please request a new one."*
3. Proof in the DB:
   ```bash
   docker exec apartment-postgres psql -U postgres -d apartment_management -c 'select "usedAt" from "PasswordResetToken";'
   ```
   The row for your token has a non-null `usedAt`.

## Scenario 3 — Expired token is rejected (45-minute default)

1. In `backend/.env`, set `PASSWORD_RESET_TOKEN_TTL_MINUTES=1` and `docker restart apartment-backend`
2. Request a reset link (Scenario 1 steps 1–2), then **wait ~2 minutes** before opening it
3. Expected: *"This reset link has expired. Please request a new one."*
4. Set `PASSWORD_RESET_TOKEN_TTL_MINUTES=45` back (or delete the line to use the default) and restart.

## Scenario 4 — Google-only account gets the *different* email

Prerequisites: an account created with Google Sign-In (no password) — see the Google auth guide.

1. On `/forgot-password`, enter the Google-only account's email and submit
2. Expected on screen: a **blue info** banner — *"This account uses Google Sign-In. Please sign in with Google instead."*
3. Check the inbox. Expected: subject **"Your OmniHome account uses Google Sign-In"** with a **Sign in with Google** button and **no reset link**.
4. Confirm no token was created:
   ```bash
   docker exec apartment-postgres psql -U postgres -d apartment_management -c "select count(*) from \"PasswordResetToken\" t join \"User\" u on u.id = t.\"userId\" where u.email = '<google-only-email>';"
   ```
   Expected: `0`.

## Scenario 5 — Unknown email shows a clear error

> Note: this intentionally reveals whether an account exists (chosen to make the UI clearer) — it deviates from the original "never reveal existence" rule.

1. On `/forgot-password`, enter an email with **no account** (e.g. `definitely-not-registered@example.com`)
2. Expected on screen: a **red** banner — *"No account found with this email address."*
3. Expected: no email arrives, and no row appears in `PasswordResetToken`.

## Scenario 6 — SMTP failure is reported, not faked

This proves a failed send never shows a "check your inbox" success.

1. In `backend/.env`, temporarily corrupt the credential: `GMAIL_APP_PASSWORD="wrong-app-password"` → `docker restart apartment-backend`
2. Submit a valid password account's email on `/forgot-password`
3. Expected: a **red** error, HTTP **502** with `{"error":{"code":"EMAIL_SEND_FAILED", ...}}` — **not** the success message
4. Check the log line; the password must be scrubbed:
   ```bash
   docker logs apartment-backend --since 2m | grep -i "email delivery failed"
   ```
   Expected: contains `Gmail SMTP delivery failed` and `[redacted]`, never the actual app password.
5. Restore the correct `GMAIL_APP_PASSWORD` and restart.

## Scenario 7 — Reset logs out other sessions (tokenVersion)

Prerequisites: two browsers (or normal + incognito), both signed in as the same user.

1. Sign in as the same user in browser A and incognito B
2. In incognito B, complete the reset flow and sign in with the new password
3. Back in browser A, refresh/navigate a dashboard page
4. Expected: browser A is logged out (its refresh token is now stale — 401 → back to login). Only the session that reset the password survives.

## Scenario 8 — Rate limiting kicks in

1. Fire 6 quick requests for the same email:
   ```bash
   for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/v1/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"admin@sunrise.com"}'; done
   ```
   (adjust the port to your `PORT`)
2. Expected: five `2xx`, then `429` with `{"error":{"code":"RATE_LIMITED",...}}`
3. The limit resets after 15 minutes.

---

## If something looks wrong

- **No email arrives at all**: check `docker logs apartment-backend` for `[EMAIL] ... (GMAIL_USER/GMAIL_APP_PASSWORD not set — not delivered)` → the env vars aren't loaded (restart after editing `backend/.env`).
- **`Gmail SMTP delivery failed: Invalid login: 535-5.7.8`**: the App Password is wrong, has spaces, or you used the normal Gmail password. Regenerate at https://myaccount.google.com/apppasswords.
- **`Gmail SMTP delivery failed: ... quota`**: Gmail's ~500/day cap was hit (see ADR 004) — try again the next day.
- **Email is in Spam**: expected for early sends from a Gmail sender; mark "not spam" to improve later delivery. This is exactly the reliability concern ADR 004 flags for production.
- **"This reset link is invalid" immediately**: make sure you opened the URL from the email (it contains `?token=...`), not just `/reset-password`.
- **Anything else**: open DevTools → Network → inspect the `forgot-password` / `reset-password` request and response and include the JSON in your report.
