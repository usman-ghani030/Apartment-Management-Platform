-- Manual payment verification (ADR 008).
--
-- A resident uploads a screenshot of an off-platform payment (bank transfer,
-- Easypaisa, JazzCash, cash deposit) against an invoice; an admin approves or
-- rejects it. Approval reuses the existing mark-invoice-paid logic, so the end
-- state matches a gateway payment while the submission and the review stay a
-- separate subsystem (NOT a PaymentProvider implementation).
--
-- Amounts are integer paisa, matching Invoice.amount and Payment.amount.
-- All changes are additive: one new table, two new enums, two nullable columns.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'CASH_DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    -- Sanitized on-disk filename. Served only via the access-controlled
    -- /api/v1/payment-proofs/:id/screenshot route, never by raw filename.
    "screenshotUrl" TEXT NOT NULL,
    "claimedAmount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transactionReference" TEXT,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProof_societyId_status_idx" ON "PaymentProof"("societyId", "status");

-- CreateIndex
CREATE INDEX "PaymentProof_societyId_createdAt_idx" ON "PaymentProof"("societyId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProof_invoiceId_idx" ON "PaymentProof"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentProof_residentId_idx" ON "PaymentProof"("residentId");

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: how the invoice was eventually paid ('gateway' | 'manual_proof')
ALTER TABLE "Invoice" ADD COLUMN "paymentSource" TEXT;

-- AlterTable: link the Payment row created by an approval back to its proof
-- (unique - one proof can never produce two payments)
ALTER TABLE "Payment" ADD COLUMN "paymentProofId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentProofId_key" ON "Payment"("paymentProofId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentProofId_fkey" FOREIGN KEY ("paymentProofId") REFERENCES "PaymentProof"("id") ON DELETE SET NULL ON UPDATE CASCADE;
