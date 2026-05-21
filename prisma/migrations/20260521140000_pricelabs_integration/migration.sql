-- CreateEnum
CREATE TYPE "PriceLabsIntegrationStatus" AS ENUM ('NOT_CONNECTED', 'PENDING_SETUP', 'CONNECTED', 'SYNC_ERROR', 'DEGRADED');

-- CreateEnum
CREATE TYPE "PropertyPriceLabsSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'ERROR');

-- CreateTable
CREATE TABLE "pricelabs_integrations" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" "PriceLabsIntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "userTokenEncrypted" TEXT,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastListingsSyncAt" TIMESTAMP(3),
    "lastPricesSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricelabs_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_pricelabs" (
    "propertyId" TEXT NOT NULL,
    "listingId" TEXT,
    "recommendedRate" DECIMAL(12,2),
    "baseRateAtSync" DECIMAL(12,2),
    "priceDelta" DECIMAL(12,2),
    "weekendUpliftPct" DECIMAL(8,4),
    "syncStatus" "PropertyPriceLabsSyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "meta" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_pricelabs_pkey" PRIMARY KEY ("propertyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricelabs_integrations_configuredById_key" ON "pricelabs_integrations"("configuredById");

-- CreateIndex
CREATE INDEX "property_pricelabs_listingId_idx" ON "property_pricelabs"("listingId");

-- AddForeignKey
ALTER TABLE "pricelabs_integrations" ADD CONSTRAINT "pricelabs_integrations_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_pricelabs" ADD CONSTRAINT "property_pricelabs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
