-- Switch payments from USD to Pakistani Rupees (PKR)

-- Update any existing rows that were created with the old default
UPDATE "Payment" SET "currency" = 'pkr' WHERE "currency" IN ('usd', 'USD', '');

-- New payments default to PKR from now on
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'pkr';
