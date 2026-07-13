-- QR Mobility Phase 0 — platform owner module (isolated from PMS domain)

CREATE TYPE "MobilityRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "MobilityAllyType" AS ENUM (
  'ACCOMMODATION',
  'AGENCY',
  'TRANSPORT',
  'TOUR_OPERATOR',
  'OTHER'
);

CREATE TYPE "MobilityServiceCategory" AS ENUM (
  'TRANSFER',
  'TOUR',
  'EXPERIENCE',
  'RENTAL',
  'TICKET',
  'OTHER'
);

CREATE TABLE "mobility_allies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MobilityAllyType" NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "commissionPercent" DECIMAL(5,2),
    "status" "MobilityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "code" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "qrImageDataUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobility_allies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mobility_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MobilityServiceCategory" NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "nightPrice" DECIMAL(12,2),
    "holidayPrice" DECIMAL(12,2),
    "scheduleText" TEXT,
    "status" "MobilityRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "recommendedVehicle" TEXT,
    "maxCapacity" INTEGER,
    "luggageAllowed" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobility_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobility_allies_code_key" ON "mobility_allies"("code");
CREATE UNIQUE INDEX "mobility_allies_qrToken_key" ON "mobility_allies"("qrToken");
CREATE INDEX "mobility_allies_status_createdAt_idx" ON "mobility_allies"("status", "createdAt" DESC);
CREATE INDEX "mobility_allies_deletedAt_idx" ON "mobility_allies"("deletedAt");
CREATE INDEX "mobility_allies_name_idx" ON "mobility_allies"("name");
CREATE INDEX "mobility_allies_type_idx" ON "mobility_allies"("type");

CREATE INDEX "mobility_services_status_sortOrder_idx" ON "mobility_services"("status", "sortOrder");
CREATE INDEX "mobility_services_deletedAt_idx" ON "mobility_services"("deletedAt");
CREATE INDEX "mobility_services_category_idx" ON "mobility_services"("category");
CREATE INDEX "mobility_services_name_idx" ON "mobility_services"("name");

ALTER TABLE "mobility_allies" ADD CONSTRAINT "mobility_allies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mobility_services" ADD CONSTRAINT "mobility_services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
