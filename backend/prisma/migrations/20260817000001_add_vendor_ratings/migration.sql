-- Phase 7 slice 3: Vendor Ratings
-- Additive only — new nullable columns on Ticket, no alterations to existing data.

ALTER TABLE "Ticket" ADD COLUMN "rating" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "ratingComment" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "ratedById" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "ratedAt" TIMESTAMP(3);

-- Index for vendor-rating aggregations (groupBy assignedTo where rating is set)
CREATE INDEX "Ticket_assignedTo_rating_idx" ON "Ticket"("assignedTo", "rating");

-- Foreign key for the rating author (the admin who closed the ticket)
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ratedById_fkey" FOREIGN KEY ("ratedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
