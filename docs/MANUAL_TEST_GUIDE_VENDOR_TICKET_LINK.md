# Manual Test Guide - Vendor Ticket Assignment Email + Magic Link

**Slice:** Maintenance Ticketing - when an admin assigns a ticket to a vendor, the vendor gets an
email with a no-login, token-secured link, and can move the ticket `ASSIGNED → IN_PROGRESS → RESOLVED`.

Related: `docs/adr/005-vendor-magic-link-access.md` (why the token is hashed, has no expiry, and can't close a ticket).

---

## 0. Prerequisites (once)

Backend and frontend running in Docker, and Gmail credentials present:

```bash
docker compose up -d
grep -E "GMAIL_USER|GMAIL_APP_PASSWORD|FRONTEND_URL|API_PUBLIC_URL" backend/.env
```

`GMAIL_USER` + `GMAIL_APP_PASSWORD` must be set (see `docs/MANUAL_TEST_GUIDE_PASSWORD_RESET.md` §0 for how to generate an App Password). `FRONTEND_URL=http://localhost:3000` and `API_PUBLIC_URL=http://localhost:4000` are the defaults the guide assumes.

---

## 1. Apply the migration (what the agent could not do without Docker running)

```bash
docker compose up -d postgres
docker exec apartment-backend npx prisma migrate deploy
docker compose up -d backend --force-recreate
```

Verify the new columns exist (they should all be empty/NULL at first):

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c '
  SELECT id, status, "assignedTo", "vendorEmail",
         ("vendorAccessTokenHash" IS NOT NULL) AS has_token
  FROM "Ticket" ORDER BY "createdAt" DESC LIMIT 5;'
```

Expected: `vendorEmail` and `has_token = f` for every existing ticket - the migration is backfill-safe and grants nobody access.

---

## 2. Assign a ticket and check the real inbox

1. Log in as the admin at `http://localhost:3000/login` - `admin@sunrise.com` / `admin123`.
2. Go to **Maintenance** (admin tickets page). Open any ticket that is not yet assigned (or click **Reassign** on one that is).
3. In **Assign to vendor...** type a vendor name, e.g. `ABC Plumbing`.
4. In **Vendor email (for the job link)** type an email address **you can actually open** (your own Gmail is the obvious choice).
5. Click **Assign**.

**Expected:**
- The page shows a green line: *"Assigned - the job link was emailed to you@example.com."*
- The ticket now shows `Assigned: ABC Plumbing · you@example.com`.
- The vendor name appears on the ticket card in the list.

**Check the inbox** (and Spam - Gmail sometimes files first-time senders there):
- Subject: **`New job assigned: #XXXXXXXX - <ticket title>`**
- Body lists Reference / Society / Unit / Category / Issue, the description, a **Photos** section if the ticket has photos, and a purple **"View job & update status"** button.

---

## 3. Open the magic link as the vendor (no login)

1. Open the email **in a different browser or an incognito window** - the whole point is that no session is needed. (Doing it in the same browser is fine functionally, but an incognito window proves there's no logged-in user involved.)
2. Click **View job & update status**.

**Expected on `http://localhost:3000/vendor/ticket/<long-token>`:**
- The OmniHome header with a **"Vendor job link"** label, no login prompt, no sidebar.
- Ticket reference (`#XXXXXXXX`), **Assigned** badge, society name, Unit, Category, Assigned to.
- Title + full description, and photo thumbnails (confirm the images actually render - if they're broken, `API_PUBLIC_URL` is wrong).
- **No resident name, no resident email or phone, no financial data, no other tickets, no comments.**
- One button: **Start work**.

---

## 4. Update the status as the vendor

1. Click **Start work**.
   - **Expected:** green banner *"Marked as in progress."*, badge changes to **In progress**, and the button becomes **Mark as resolved**.
2. Click **Mark as resolved**.
   - **Expected:** a confirm button appears: **"Confirm - job is complete"**. Click it.
   - **Expected:** green banner *"Thanks - this job is marked resolved..."*, badge becomes **Resolved**, and no further update buttons appear.
3. Refresh the page - the status persists (the link is reusable, by design).

---

## 5. Confirm the admin sees it, and that it's attributed to the vendor

1. Back in the admin browser, reload the tickets page and open the same ticket.
2. **Expected:** status is **RESOLVED**, and the vendor can't be closed by the vendor - only the admin sees **Close & rate**.
3. Verify the audit attribution (the vendor has no account, so it must not be attributed to a user):

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c '
  SELECT action, "actorUserId", "afterJson" FROM "AuditLog"
  WHERE action = '"'"'TICKET_STATUS_UPDATED_BY_VENDOR'"'"' ORDER BY "createdAt" DESC LIMIT 5;'
```

**Expected:** one row per vendor action, `actorUserId` **NULL**, and `afterJson` containing
`"vendor": "ABC Plumbing"` and `"via": "vendor_magic_link"`.

---

## 6. Closing the ticket kills the link

1. As the admin, click **Close & rate** on the resolved ticket, pick a rating, confirm.
2. As the vendor, reload the magic link.
3. **Expected:** the job view is gone, replaced by **"This link isn't usable"** / *"This ticket has been closed by the society. No further updates are needed."*
4. Note the intended design here: the token hash is **kept** and the closed-status check denies it, so the vendor gets the explanatory message instead of a bare "invalid link". (Reassignment *does* rotate the hash - see §7.) So the row below still shows `has_token = t` after closing:

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c '
  SELECT status, ("vendorAccessTokenHash" IS NOT NULL) AS has_token
  FROM "Ticket" WHERE "assignedTo" = '"'"'ABC Plumbing'"'"' ORDER BY "updatedAt" DESC LIMIT 1;'
# Expected: status = CLOSED, has_token = t  (kept on purpose - the status check denies access)
```

---

## 7. Reassignment invalidates the old vendor's link

1. As the admin, open a ticket assigned to `ABC Plumbing` and click **Reassign**.
2. Change the name to `XYZ Electrical` and type a **different** email you can open. Click **Assign**.
3. **Expected:**
   - A green *"Assigned - the job link was emailed to..."* message.
   - A **new** email arrives for XYZ Electrical with a **different** link.
4. Open the **old** ABC Plumbing link (from the earlier email) in a browser.
   - **Expected:** **"This link isn't usable"** - the old token was rotated away.
5. Confirm the old email address was **not** contacted: check that the ABC inbox got no new message for this assignment.

---

## 8. Bad tokens and revoked access

| Test | What to do | Expected |
|---|---|---|
| Garbage token | Visit `http://localhost:3000/vendor/ticket/not-a-real-token` | "This link isn't usable" - and no DB row is even queried |
| Unknown but well-formed token | Visit `/vendor/ticket/` + 43 random characters | Same message |
| Unassigned ticket | Reassign a ticket and leave the email blank, then open the old link | Revoked - same message; **no email is sent** |
| Closed ticket | Open a link for a ticket an admin has closed | *"This ticket has been closed by the society. No further updates are needed."* |
| Rate limit | Fire 31 requests for one token in a row (below) | Five-ish `200`s, then `429 RATE_LIMITED` |

```bash
TOKEN=...paste-the-token-from-the-email-link...
for i in $(seq 1 32); do
  curl -s -o /dev/null -w "%{http_code} " "http://localhost:4000/api/v1/vendor/ticket/$TOKEN"
done; echo
```

---

## 9. Verify only the hash is stored (never the token)

```bash
TOKEN=...paste-the-token-from-the-email-link...
docker exec apartment-postgres psql -U postgres -d apartment_management -c \
  "SELECT count(*) FROM \"Ticket\" WHERE \"vendorAccessTokenHash\" = '$TOKEN';"
# Expected: 0 - the raw token never appears in the database.

docker exec apartment-postgres psql -U postgres -d apartment_management -c \
  "SELECT left(\"vendorAccessTokenHash\", 12) FROM \"Ticket\" WHERE \"assignedTo\" = 'XYZ Electrical';"
# Expected: a 64-character SHA-256 hex digest (shown truncated here)
```

---

## If something looks wrong

- **"Assigned, but no vendor email was provided so no job link was sent."** → type the vendor's email next to the name. Assigning without one is allowed but deliberately sends nothing.
- **A red error about the email not being sent (502)** → the assignment *was* saved, but Gmail rejected the message. Check the backend log for the sanitized reason (it never prints the password):
  ```bash
  docker logs apartment-backend --since 5m 2>&1 | grep -i "VendorAssignment\|Gmail SMTP"
  ```
  Common causes: wrong `GMAIL_APP_PASSWORD`, Gmail's ~500/day cap, or the sending account being flagged.
- **The button/link works locally but photos don't render** → `API_PUBLIC_URL` isn't reachable from the browser.
- **The link 404s even though it just arrived** → the ticket was reassigned or closed in between (both revoke it), or you edited a line break into the copied URL.
- Re-sending an assignment email after fixing credentials: click **Reassign** and save again - that rotates the token and emails a fresh link.

---

## Deployment note (Render + Vercel)

Set on **Render**: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FRONTEND_URL` (the Vercel URL), `API_PUBLIC_URL` (the Render URL).
Without `API_PUBLIC_URL` the email's photo links point at `localhost:4000`, and without `FRONTEND_URL` the button points at `localhost:3000`.
