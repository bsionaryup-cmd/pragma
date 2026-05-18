-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN "description" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'CO',
ADD COLUMN "beds" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "checkInTime" TEXT DEFAULT '15:00',
ADD COLUMN "checkOutTime" TEXT DEFAULT '11:00',
ADD COLUMN "accessInstructions" TEXT,
ADD COLUMN "houseRules" TEXT,
ADD COLUMN "baseRate" DECIMAL(12,2),
ADD COLUMN "cleaningFee" DECIMAL(12,2),
ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "status" "PropertyStatus",
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'COP';

-- Migrate isActive -> status
UPDATE "properties" SET "status" = 'ACTIVE' WHERE "isActive" = true;
UPDATE "properties" SET "status" = 'INACTIVE' WHERE "isActive" = false;
UPDATE "properties" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

ALTER TABLE "properties" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropIndex
DROP INDEX "properties_ownerId_isActive_idx";

-- DropColumn
ALTER TABLE "properties" DROP COLUMN "isActive";

-- CreateIndex
CREATE INDEX "properties_ownerId_status_idx" ON "properties"("ownerId", "status");
