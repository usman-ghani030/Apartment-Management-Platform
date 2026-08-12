-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('ARRIVED', 'COLLECTED');

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "loggedByUserId" TEXT NOT NULL,
    "collectedByUserId" TEXT,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "status" "ParcelStatus" NOT NULL DEFAULT 'ARRIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parcel_societyId_idx" ON "Parcel"("societyId");

-- CreateIndex
CREATE INDEX "Parcel_societyId_status_idx" ON "Parcel"("societyId", "status");

-- CreateIndex
CREATE INDEX "Parcel_unitId_idx" ON "Parcel"("unitId");

-- CreateIndex
CREATE INDEX "Parcel_societyId_createdAt_idx" ON "Parcel"("societyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
