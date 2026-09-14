-- Vendor magic-link access (Maintenance Ticketing follow-up).
--
-- Vendors do not have login accounts (PLAN.md §13), so an assigned vendor gets a
-- token-secured public link. Only the SHA-256 hash of the token is stored — the
-- raw token exists only inside the emailed URL, so a DB leak cannot be replayed.
--
-- The token is deliberately NOT single-use and NOT time-limited: the vendor
-- needs to return to the same link over several days ("In Progress" today,
-- "Resolved" later). It is invalidated by rotating it on reassignment (the old
-- hash is overwritten) and by clearing it when the ticket is CLOSED.
--
-- All columns are additive and nullable — safe for existing rows in production.

ALTER TABLE "Ticket" ADD COLUMN "vendorEmail" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "vendorAccessTokenHash" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "vendorAccessTokenIssuedAt" TIMESTAMP(3);

-- CreateIndex (unique — lookups by token hash, and no two tickets can share one)
CREATE UNIQUE INDEX "Ticket_vendorAccessTokenHash_key" ON "Ticket"("vendorAccessTokenHash");
