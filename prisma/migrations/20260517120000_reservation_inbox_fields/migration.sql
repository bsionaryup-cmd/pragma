-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'CHECKOUT_TODAY';
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "guestFirstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "guestLastName" TEXT,
ADD COLUMN     "guestCountry" TEXT,
ADD COLUMN     "guestLanguage" TEXT,
ADD COLUMN     "adults" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "children" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "infants" INTEGER NOT NULL DEFAULT 0;

-- Backfill guestFirstName from guestName
UPDATE "reservations"
SET "guestFirstName" = "guestName"
WHERE "guestFirstName" = '';
