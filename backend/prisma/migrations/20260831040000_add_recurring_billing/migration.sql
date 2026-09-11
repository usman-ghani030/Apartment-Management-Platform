-- AlterTable: Add billingDayOfMonth to Society
ALTER TABLE "Society" ADD COLUMN "billingDayOfMonth" INTEGER;

-- AlterTable: Add billingPeriod to Invoice
ALTER TABLE "Invoice" ADD COLUMN "billingPeriod" TEXT;

-- CreateIndex: Unique constraint for idempotent billing
CREATE UNIQUE INDEX "unique_billing_period" ON "Invoice"("societyId", "unitId", "billingPeriod");
