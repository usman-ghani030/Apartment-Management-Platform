-- Vendor contact flexibility: a vendor needs at least one contact channel, not
-- both. `email` was already nullable; `phone` was NOT NULL.
--
-- This is a constraint relaxation only - no data change, no backfill. The
-- "at least one of email/phone" rule is enforced by the shared Zod schema
-- (CreateVendorSchema / UpdateVendorSchema) rather than by the database, because
-- it is a cross-column rule that the API is the only writer for.
--
-- Pre-flight check (should return 0 rows, since phone could not be NULL before
-- this migration): any vendor that would end up with neither contact method.
--   SELECT id, name FROM "Vendor" WHERE "deletedAt" IS NULL AND "email" IS NULL AND "phone" IS NULL;

ALTER TABLE "Vendor" ALTER COLUMN "phone" DROP NOT NULL;

-- The old flow required a phone, so an email the admin left blank was stored as
-- '' rather than NULL. Collapse those to NULL so "no email" has exactly one
-- representation that every `?? null` / truthiness check agrees on. This is a
-- representation change only - no row loses a value it actually had.
UPDATE "Vendor" SET "email" = NULL WHERE "email" = '';
UPDATE "Vendor" SET "phone" = NULL WHERE "phone" = '';

-- Verify afterwards: this must return 0 rows. Any row here predates the rule
-- and has no way to be contacted (ACTION REQUIRED - set a contact manually):
--   SELECT id, name FROM "Vendor" WHERE "deletedAt" IS NULL AND "email" IS NULL AND "phone" IS NULL;
