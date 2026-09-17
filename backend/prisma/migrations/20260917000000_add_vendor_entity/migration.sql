-- Vendor entity for the maintenance assignment flow.
--
-- Until now vendors existed only as free text on Ticket.assignedTo. This adds a
-- first-class, tenant-scoped Vendor record (name + E.164 mobile) so admins can
-- search-and-select vendors on the assignment form and open a manual wa.me deep
-- link after assigning. Vendors still have NO login accounts (PLAN.md §13).
--
-- `phone` is stored in E.164 (+92XXXXXXXXXX); normalization happens in the shared
-- Zod transform at the API boundary, not in the database. The table is new, so
-- there is nothing to backfill - existing tickets keep their free-text
-- Ticket.assignedTo values and simply have vendorId = NULL until reassigned.
--
-- Additive only: no existing column is altered or dropped.

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_societyId_name_idx" ON "Vendor"("societyId", "name");

-- CreateIndex
CREATE INDEX "Vendor_societyId_phone_idx" ON "Vendor"("societyId", "phone");

-- CreateIndex
CREATE INDEX "Vendor_societyId_createdAt_idx" ON "Vendor"("societyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable (nullable - legacy tickets have no vendor record)
ALTER TABLE "Ticket" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_societyId_vendorId_idx" ON "Ticket"("societyId", "vendorId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
