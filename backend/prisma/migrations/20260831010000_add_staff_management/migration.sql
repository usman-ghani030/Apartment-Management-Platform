-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('GUARD', 'CLEANER', 'MAINTENANCE', 'OTHER');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_societyId_idx" ON "Staff"("societyId");

-- CreateIndex
CREATE INDEX "Staff_societyId_isActive_idx" ON "Staff"("societyId", "isActive");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
