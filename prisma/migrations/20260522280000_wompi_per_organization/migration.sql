-- Per-organization Wompi credentials (multi-tenant)

ALTER TABLE "wompi_integrations" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "wompi_integrations" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "wompi_integrations" ADD COLUMN IF NOT EXISTS "lastHealthCheckAt" TIMESTAMP(3);
ALTER TABLE "wompi_integrations" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- Migrate singleton row to the configurator's organization
UPDATE "wompi_integrations" wi
SET "organizationId" = u."organizationId"
FROM "users" u
WHERE wi."configuredById" = u.id
  AND wi."organizationId" IS NULL
  AND u."organizationId" IS NOT NULL;

-- Remove legacy singleton rows that cannot be assigned to an organization
DELETE FROM "wompi_integrations"
WHERE "organizationId" IS NULL;

ALTER TABLE "wompi_integrations" ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX IF EXISTS "wompi_integrations_configuredById_key";

CREATE UNIQUE INDEX IF NOT EXISTS "wompi_integrations_organizationId_key"
  ON "wompi_integrations"("organizationId");

ALTER TABLE "wompi_integrations"
  ADD CONSTRAINT "wompi_integrations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- New rows use cuid(); existing migrated rows keep their id
ALTER TABLE "wompi_integrations" ALTER COLUMN "id" DROP DEFAULT;
