-- Multi-tenant organization integrations (PriceLabs per organization)

DO $$ BEGIN
  CREATE TYPE "OrganizationIntegrationProvider" AS ENUM ('PRICELABS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationIntegrationStatus" AS ENUM (
    'NOT_CONNECTED',
    'CONNECTED',
    'INVALID_KEY',
    'SYNC_REQUIRED',
    'SYNC_FAILED',
    'DEGRADED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "organization_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "OrganizationIntegrationProvider" NOT NULL,
    "apiKeyEncrypted" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastListingsSyncAt" TIMESTAMP(3),
    "lastPricesSyncAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "syncInProgressAt" TIMESTAMP(3),
    "status" "OrganizationIntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "lastError" TEXT,
    "metadata" JSONB,
    "neighborhoodSnapshot" JSONB,
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_integrations_organizationId_provider_key"
  ON "organization_integrations"("organizationId", "provider");

CREATE INDEX IF NOT EXISTS "organization_integrations_organizationId_idx"
  ON "organization_integrations"("organizationId");

CREATE INDEX IF NOT EXISTS "organization_integrations_provider_status_idx"
  ON "organization_integrations"("provider", "status");

DO $$ BEGIN
  ALTER TABLE "organization_integrations"
    ADD CONSTRAINT "organization_integrations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "organization_integrations"
    ADD CONSTRAINT "organization_integrations_configuredById_fkey"
    FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Migrate legacy singleton PriceLabs row → per-organization integration
INSERT INTO "organization_integrations" (
    "id",
    "organizationId",
    "provider",
    "apiKeyEncrypted",
    "isConnected",
    "connectedAt",
    "lastSyncAt",
    "lastListingsSyncAt",
    "lastPricesSyncAt",
    "lastHealthCheckAt",
    "syncInProgressAt",
    "status",
    "lastError",
    "neighborhoodSnapshot",
    "configuredById",
    "createdAt",
    "updatedAt"
)
SELECT
    'pl_' || u."organizationId",
    u."organizationId",
    'PRICELABS'::"OrganizationIntegrationProvider",
    pi."integrationTokenEncrypted",
    pi."status" = 'CONNECTED',
    CASE WHEN pi."status" = 'CONNECTED' THEN pi."updatedAt" ELSE NULL END,
    GREATEST(pi."lastListingsSyncAt", pi."lastPricesSyncAt"),
    pi."lastListingsSyncAt",
    pi."lastPricesSyncAt",
    pi."lastHealthCheckAt",
    pi."syncInProgressAt",
    CASE pi."status"
        WHEN 'NOT_CONNECTED' THEN 'NOT_CONNECTED'::"OrganizationIntegrationStatus"
        WHEN 'PENDING_SETUP' THEN 'SYNC_REQUIRED'::"OrganizationIntegrationStatus"
        WHEN 'CONNECTED' THEN 'CONNECTED'::"OrganizationIntegrationStatus"
        WHEN 'SYNC_ERROR' THEN 'SYNC_FAILED'::"OrganizationIntegrationStatus"
        WHEN 'DEGRADED' THEN 'DEGRADED'::"OrganizationIntegrationStatus"
        ELSE 'NOT_CONNECTED'::"OrganizationIntegrationStatus"
    END,
    pi."lastError",
    NULL::jsonb,
    pi."configuredById",
    pi."createdAt",
    pi."updatedAt"
FROM "pricelabs_integrations" pi
INNER JOIN "users" u ON u."id" = pi."configuredById"
WHERE pi."configuredById" IS NOT NULL
  AND u."organizationId" IS NOT NULL
ON CONFLICT ("organizationId", "provider") DO NOTHING;

ALTER TABLE "pricelabs_sync_logs" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "pricelabs_sync_logs_organizationId_createdAt_idx"
  ON "pricelabs_sync_logs"("organizationId", "createdAt" DESC);
