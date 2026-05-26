-- Tenant Airbnb Email Integration + listing maps (additive)

CREATE TYPE "AirbnbEmailIntegrationStatus" AS ENUM ('DISABLED', 'ACTIVE', 'ERROR');
CREATE TYPE "AirbnbEmailInboundProvider" AS ENUM ('RESEND', 'MANUAL');

CREATE TABLE "tenant_airbnb_email_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "AirbnbEmailInboundProvider" NOT NULL DEFAULT 'RESEND',
    "inboundEmailAddress" TEXT NOT NULL,
    "syncStatus" "AirbnbEmailIntegrationStatus" NOT NULL DEFAULT 'DISABLED',
    "lastEmailReceivedAt" TIMESTAMP(3),
    "lastProcessedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "webhookConfiguredAt" TIMESTAMP(3),
    "featureFlags" JSONB,
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_airbnb_email_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "airbnb_listing_email_maps" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "airbnbRoomId" TEXT,
    "listingName" TEXT NOT NULL,
    "listingNameNorm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airbnb_listing_email_maps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_airbnb_email_integrations_organizationId_key" ON "tenant_airbnb_email_integrations"("organizationId");
CREATE UNIQUE INDEX "tenant_airbnb_email_integrations_inboundEmailAddress_key" ON "tenant_airbnb_email_integrations"("inboundEmailAddress");
CREATE INDEX "tenant_airbnb_email_integrations_enabled_syncStatus_idx" ON "tenant_airbnb_email_integrations"("enabled", "syncStatus");

CREATE UNIQUE INDEX "airbnb_listing_email_maps_organizationId_propertyId_key" ON "airbnb_listing_email_maps"("organizationId", "propertyId");
CREATE INDEX "airbnb_listing_email_maps_organizationId_listingNameNorm_idx" ON "airbnb_listing_email_maps"("organizationId", "listingNameNorm");
CREATE INDEX "airbnb_listing_email_maps_organizationId_airbnbRoomId_idx" ON "airbnb_listing_email_maps"("organizationId", "airbnbRoomId");

ALTER TABLE "tenant_airbnb_email_integrations" ADD CONSTRAINT "tenant_airbnb_email_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_airbnb_email_integrations" ADD CONSTRAINT "tenant_airbnb_email_integrations_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "airbnb_listing_email_maps" ADD CONSTRAINT "airbnb_listing_email_maps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "airbnb_listing_email_maps" ADD CONSTRAINT "airbnb_listing_email_maps_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_ingestion_audit" ADD CONSTRAINT "email_ingestion_audit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
