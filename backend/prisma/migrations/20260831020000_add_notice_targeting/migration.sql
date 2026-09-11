-- AlterTable: Add targeting fields to Notice
ALTER TABLE "Notice" ADD COLUMN "targetType" TEXT NOT NULL DEFAULT 'ALL_UNITS';
ALTER TABLE "Notice" ADD COLUMN "targetUnitIds" JSONB;
