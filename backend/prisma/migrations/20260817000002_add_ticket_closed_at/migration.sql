-- Phase 7 slice 4: Analytics
-- Additive only — new nullable column for accurate ticket resolution time.

ALTER TABLE "Ticket" ADD COLUMN "closedAt" TIMESTAMP(3);
