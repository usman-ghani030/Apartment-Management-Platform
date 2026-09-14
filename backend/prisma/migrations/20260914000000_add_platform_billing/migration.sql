-- Phase 9: Platform Billing (ADR 006) — societies paying the platform.
-- Additive and backfill-safe: new tables only, no changes to existing rows.

-- Enum for platform invoice status (distinct from resident InvoiceStatus).
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "unitCountSnapshot" INTEGER NOT NULL,
    "calculationBreakdown" JSONB NOT NULL,
    "totalAmountPaisa" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "markedPaidBySuperAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformCustomQuoteFlag" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "unitCountSnapshot" INTEGER NOT NULL,
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformCustomQuoteFlag_pkey" PRIMARY KEY ("id")
);

-- Idempotency: one invoice per society per billing period.
-- (Primary-key indexes are created by the inline PRIMARY KEY constraints above.)
CREATE UNIQUE INDEX "unique_platform_billing_period" ON "PlatformInvoice"("societyId", "billingPeriod");

CREATE UNIQUE INDEX "unique_platform_quote_flag_period" ON "PlatformCustomQuoteFlag"("societyId", "billingPeriod");

CREATE INDEX "PlatformInvoice_societyId_status_idx" ON "PlatformInvoice"("societyId", "status");
CREATE INDEX "PlatformInvoice_status_dueDate_idx" ON "PlatformInvoice"("status", "dueDate");

-- Foreign keys
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_markedPaidBySuperAdminUserId_fkey" FOREIGN KEY ("markedPaidBySuperAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformCustomQuoteFlag" ADD CONSTRAINT "PlatformCustomQuoteFlag_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
