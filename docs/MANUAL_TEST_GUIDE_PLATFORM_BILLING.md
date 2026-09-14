# Manual Test Guide — Phase 9 Platform Billing (Societies Paying the Platform)

**Feature:** every active society gets a monthly platform invoice based on its active unit count, calculated **progressively** (ADR 006). Committee Admins see a read-only billing page with payment instructions; a **SUPER_ADMIN** membership gets the platform-ops panels (all societies, mark-as-paid, custom-quote flags, run controls). Resident dues (Invoices page) are a completely separate system.

Prerequisites: the stack is up (`docker compose up -d`), the backend is on `http://localhost:4000`, frontend on `http://localhost:3000`.

---

## 0. One-time setup: apply the migration + create a SUPER_ADMIN membership

The migration is additive and safe. Run it **inside the container** (it has the DB URL):

```bash
docker exec apartment-backend npx prisma migrate deploy
docker restart apartment-backend   # pick up the new route/code
```

There is no UI to grant the SUPER_ADMIN role (it's a platform-ops role, not sold to customers), so seed one for testing directly:

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c "
UPDATE \"Membership\" SET role = 'SUPER_ADMIN'
WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'admin@sunrise.com')
  AND \"societyId\" = (SELECT id FROM \"Society\" WHERE slug = 'sunrise');"
```

> Replace `admin@sunrise.com` / `sunrise` with your actual admin login if different.
> Sign out and back in afterward so the fresh role is loaded into the session.
> **To revert after testing:** run the same UPDATE with `'COMMITTEE_ADMIN'`.

---

## 1. Dry run first (nothing is written)

Log in as the admin you promoted → **Platform billing** (sidebar, under Finance & Records) → scroll to **Platform operations** → click **Dry run**.

Expected message, e.g.:

```
DRY RUN — nothing was written. Societies scanned: 2, invoices would be created: 1,
free-tier skipped: 0, already existing: 0, custom-quote flags: 0
```

Confirm in the DB that nothing was written:

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c \
  'SELECT count(*) FROM "PlatformInvoice";'
```

Expected: `0` (or whatever existed before — unchanged).

---

## 2. Real generation

Click **Generate for this month**.

Expected message: same shape, without "DRY RUN", with `invoices created: 1` (or however many societies have >15 units).

On the same page, **Your society's invoices** now shows a card: period (e.g. "September 2026"), unit count, due date, `PENDING` badge, and the total.

**Verify the progressive math against the unit count** (expand "How this total was calculated"):

| Society units | Expected total |
|---|---|
| 15 or fewer | no invoice at all (skipped silently) |
| 16 | Rs 20 |
| 50 | Rs 700 |
| 51 | Rs 712 |
| 100 | Rs 1,300 |
| 200 | Rs 2,500 |
| 201 | Rs 2,508 |
| 500 | Rs 4,900 |

The expanded breakdown must show the bands separately (e.g. for 100 units: *Units 1–15 free, Units 16–50 → Rs 700, Units 51–100 → Rs 600, total Rs 1,300*) — **not** one flat rate × unit count.

**Idempotency:** click **Generate for this month** again → `already existing: N`, `created: 0`, and no duplicate rows:

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c \
  'SELECT "billingPeriod", count(*) FROM "PlatformInvoice" GROUP BY 1;'
```

---

## 3. Custom-quote flag (501+ units)

Only needed if you want to see the flag path. Temporarily inflate a society's unit count with soft-deleted-safe test rows, run generation, then clean up:

```bash
SID=$(docker exec apartment-postgres psql -U postgres -d apartment_management -tAc \
  "SELECT id FROM \"Society\" WHERE slug='sunrise'")
docker exec apartment-postgres psql -U postgres -d apartment_management -c "
INSERT INTO \"Unit\" (id, \"societyId\", \"buildingId\", \"unitNumber\", \"createdAt\", \"updatedAt\")
SELECT gen_random_uuid()::text, '$SID',
       (SELECT id FROM \"Building\" WHERE \"societyId\"='$SID' LIMIT 1),
       'T-' || g, now(), now()
FROM generate_series(1, 490) g
ON CONFLICT DO NOTHING;"
```

Run **Generate for this month** → the message reports `custom-quote flags: 1` and `created` unchanged. The **"Societies needing a custom quote (501+ units)"** panel lists the society. **No** new platform invoice row is created for it.

Clean up:

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c "
DELETE FROM \"Unit\" WHERE \"unitNumber\" LIKE 'T-%';"
```

---

## 4. Mark as paid (Super Admin only)

In the **All societies' invoices** list, find a `PENDING` invoice → **Mark as paid** → the badge flips to `PAID` with "confirmed by …".

**A Committee Admin must NOT be able to do this.** Revert the role (step 0's revert SQL), sign out/in, open Platform billing as a plain Committee Admin:

- The **Platform operations** section is hidden, and hitting the API directly still fails:

```bash
TOKEN=<a committee-admin access token>
curl -s -X PATCH http://localhost:4000/api/v1/platform-billing/<invoice-id>/mark-paid \
  -H 'Content-Type: application/json' -H "x-access-token: $TOKEN" -d '{}'
# Expected: 403 FORBIDDEN
```

- **Tenant isolation:** as that admin,

```bash
curl -s http://localhost:4000/api/v1/platform-billing/all -H "x-access-token: $TOKEN"
# Expected: 403 FORBIDDEN
curl -s http://localhost:4000/api/v1/platform-billing -H "x-access-token: $TOKEN"
# Expected: 200 but ONLY their own society's invoices (societyId fields all match their society)
```

Restore the SUPER_ADMIN role (step 0 SQL) if you want to keep testing as ops.

---

## 5. Overdue handling + reminder email

Create an overdue invoice the honest way — set its due date in the past, then run the check:

```bash
docker exec apartment-postgres psql -U postgres -d apartment_management -c "
UPDATE \"PlatformInvoice\" SET \"dueDate\" = now() - interval '10 days'
WHERE status = 'PENDING';"
```

Click **Run overdue check** → message reports `marked overdue: N, reminder emails sent: N`. The invoice badge becomes `OVERDUE`. The Committee Admin inbox (GMAIL_USER inbox, or any admin email if you're testing delivery to a different address) receives *"Action needed: platform invoice … is overdue"* mentioning the amount, period, and that access is not restricted.

No feature of the society is gated by this state (ADR 006) — verify the society's app still works normally (post a notice, raise a ticket).

**Idempotency:** run the check again → `marked overdue: 0` (already-OVERDUE invoices aren't re-processed, no duplicate emails).

If nothing arrives: check `docker logs apartment-backend --since 5m | grep -i "platform"` and the Gmail creds in `backend/.env`.

---

## 6. Committee Admin read-only view (final state check)

As a plain Committee Admin (not super admin): **Platform billing** shows the status banner (free tier / estimated fee), payment instructions with the clearly-marked `[BANK DETAILS PLACEHOLDER — TO BE PROVIDED]` (only when billable), the society's invoice cards with expandable calculations, and **no** run buttons / mark-paid buttons / other societies' data. The resident dashboard has **no** Platform billing link and `GET /api/v1/platform-billing` with a resident token returns 403.

---

## 7. Free-tier experience

With the seeded society at 5 units (and no SUPER_ADMIN role), open **Platform billing**:

- Green banner: **"You're on the free tier 🎉"** — shows the unit count (5), the free threshold (15),
  that every feature is included, and what happens if the society grows past 15 units.
- The **How to pay** block is **hidden** — there is nothing to pay on the free tier.
- Invoice list: *"Nothing to pay — 5 of your 15 free units are in use."*
- No Platform operations panels (those are super-admin only).

Add >15 units (step 3's SQL with `generate_series(1, 45)` for 50 total) and reload:
the banner switches to **"Estimated fee today: Rs 700/month"** and the How-to-pay block appears.
Delete the `PBTEST-%` units afterwards to return to the free tier.

---

## If something looks wrong

Send me: the exact on-screen message, the HTTP status + body from the failing `curl`, and `docker logs apartment-backend --since 10m | grep -iE "platform|error"`.
