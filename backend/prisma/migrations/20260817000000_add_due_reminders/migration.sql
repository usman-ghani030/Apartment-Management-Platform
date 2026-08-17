-- Automated Dues Reminders (Phase 7)

-- Per-society setting: how many days before the due date to send the reminder
ALTER TABLE "Society" ADD COLUMN "dueReminderDays" INTEGER NOT NULL DEFAULT 3;

-- Reminder history: one row per (invoice, due date) reminder sent
CREATE TABLE "InvoiceReminder" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReminder_invoiceId_dueDate_key" ON "InvoiceReminder"("invoiceId", "dueDate");

-- CreateIndex
CREATE INDEX "InvoiceReminder_societyId_idx" ON "InvoiceReminder"("societyId");

-- CreateIndex
CREATE INDEX "InvoiceReminder_invoiceId_idx" ON "InvoiceReminder"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
