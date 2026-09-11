# Manual Test Guide: Google Sign-In

> You need **real Google accounts** to test this (GSI doesn't work with fake emails).
> If you have one Gmail address, you can test everything; two Gmail addresses make
> the multi-account scenarios easier.

## Prerequisites

1. Everything running locally:
   - `docker compose up -d` (Postgres + Redis + backend on `http://localhost:4000`)
   - `npm run dev` (frontend on `http://localhost:3000`)
2. Env vars present:
   - `backend/.env`: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (already there)
   - `frontend/.env`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (added — same public client ID)
3. Migration applied: `docker exec apartment-backend npx prisma migrate deploy` (already done locally)
4. **Google Cloud Console check (do this once):**
   - Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client
   - "Authorized JavaScript origins" must include `http://localhost:3000` (and your
     production origin, e.g. `https://yourapp.vercel.app`). If localhost is missing,
     add it and save — otherwise the Google button shows an origin-mismatch error.

---

## Scenario 1 — New user creates a society with Google (signup page)

Prerequisites: none (fresh Google account)

1. In an incognito window (clean cookies), go to `http://localhost:3000/signup`
2. In the **Society Name** box type e.g. `Test Google Society` — the Society URL
   auto-fills with `test-google-society`
3. Click the **"Sign in with Google"** button at the top of the card (do NOT fill
   the email/password form)
4. In the Google picker, choose a Google account whose email has **no** OmniHome account
5. Expected result: you land on `/dashboard/admin` for your new society, with no
   password ever created
6. Check the society exists: Admin dashboard loads with your name (from Google)

If something looks wrong: open DevTools → Network → the `/api/v1/auth/google` request;
send the response back.

---

## Scenario 2 — Existing user links Google to their password account (login page)

Prerequisites: Scenario 1 done (so you have a real email + society), or create one now
with your Gmail via the normal password signup form.

1. Log out (top-right menu) — or open a fresh incognito window
2. Go to `http://localhost:3000/login`
3. Click **"Sign in with Google"**
4. Pick the **same Google account** whose email already has an OmniHome account
   (the one from Scenario 1, or a Gmail you registered with a password)
5. Expected result: a green banner — *"Your Google account has been linked to your
   existing OmniHome account."* — then you're redirected to your dashboard
6. Sign out again, and this time log in with **email + password** (the original
   password) — it must still work (account wasn't replaced, just linked)
7. Verify the audit trail: as admin → Audit Log → you should see a
   `GOOGLE_ACCOUNT_LINKED` entry for your user

If something looks wrong: check the audit log shows the link; check `googleId` is set
in the DB (`docker exec apartment-postgres psql -U postgres -d apartment_management
-c 'select email, "googleId", "emailVerified" from "User";'`).

---

## Scenario 3 — Google sign-in with an unknown email is rejected (no self-signup)

Prerequisites: a Google account with no OmniHome account (e.g. a second Gmail, or a
Gmail you've never registered)

1. Log out / fresh incognito
2. Go to `http://localhost:3000/login`
3. Click **"Sign in with Google"** and pick the unknown-email Google account
4. Expected result: **red error** — *"No account exists for this email. Ask your
   society admin to invite you, or create a new society."* — you are NOT logged in
5. Confirm no account was created: log in normally as any admin → Audit Log has no
   new entries; DB `select email from "User" where email = '<that email>'` returns nothing

This is the security-critical case: a random Google account must never get access.

---

## Scenario 4 — Invited resident signs in with Google

Prerequisites: any society with units; a Google account (Gmail) that is NOT yet a user.

1. As admin → Members → Invite Resident → invite `your-gmail@gmail.com` (pick a unit)
2. Log out; go to `/login` → **Sign in with Google** → pick `your-gmail@gmail.com`
3. Expected result: green "linked" banner → redirected to the **resident** dashboard
   (because the invite created the User row, Google just proves ownership)

---

## Scenario 5 — Already-linked Google account (no duplicate link banner)

1. Sign out, then Google-sign-in again with the same account from Scenario 2
2. Expected result: straight to the dashboard, **no** green "linked" banner

---

## Scenario 6 — Google-only account has no usable password

Prerequisites: Scenario 1 (Google-created account)

1. Log out; go to `/login`
2. Enter the Google account's email and any password
3. Expected result: red error — *"Invalid email or password"* (Google-only accounts
   must use Google)

---

## If the Google button doesn't appear at all

- Check `frontend/.env` has `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set, then **restart**
  `npm run dev` (Next.js reads env at startup)
- Check the GSI script loaded: DevTools → Network → `gsi/client` should be 200
- If the button appears but errors on click, the most common cause is the
  **Authorized JavaScript origins** in Google Cloud Console missing `http://localhost:3000`

## Production (Railway/Vercel) checklist

- Backend env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Frontend env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- Apply migration on the prod DB: `npx prisma migrate deploy`
- Google Cloud Console → add the production origin to Authorized JavaScript origins