-- AlterTable: add Safepay payment provider fields to Payment
ALTER TABLE "Payment" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'offline',
ADD COLUMN "providerSessionId" TEXT,
ADD COLUMN "providerTxnRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerSessionId_key" ON "Payment"("providerSessionId");
