-- Google Sign-In: add googleId + emailVerified to User, allow passwordless (Google-only) accounts.
-- All changes are additive / nullable — safe for existing rows in production.

-- AlterTable: existing users keep their password; Google-only accounts get NULL
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add googleId (nullable, unique) and emailVerified (defaults false, so existing
-- rows are untouched — set to true only when Google verifies email ownership)
ALTER TABLE "User" ADD COLUMN "googleId" TEXT,
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");