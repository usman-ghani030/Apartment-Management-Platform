-- CreateEnum: BedroomType
CREATE TYPE "BedroomType" AS ENUM ('STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'FOUR_BED', 'FOUR_PLUS_BED');

-- AlterTable: Add new nullable columns to Unit
ALTER TABLE "Unit" ADD COLUMN "bedroomType" "BedroomType";
ALTER TABLE "Unit" ADD COLUMN "primaryContactName" TEXT;
ALTER TABLE "Unit" ADD COLUMN "primaryContactEmail" TEXT;
ALTER TABLE "Unit" ADD COLUMN "primaryContactPhone" TEXT;
