-- TTLock per-organization scope (mirrors Wompi multi-tenant pattern)

ALTER TABLE "ttlock_integrations" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ttlock_integrations" ADD COLUMN IF NOT EXISTS "configuredById" TEXT;
ALTER TABLE "ttlock_integrations" ADD COLUMN IF NOT EXISTS "gatewayId" TEXT;
ALTER TABLE "ttlock_integrations" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ttlock_integrations" ti
SET "organizationId" = u."organizationId",
    "configuredById" = ti."userId"
FROM "users" u
WHERE ti."userId" = u.id
  AND u."organizationId" IS NOT NULL
  AND ti."organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ttlock_integrations_organizationId_key"
  ON "ttlock_integrations"("organizationId")
  WHERE "organizationId" IS NOT NULL;

ALTER TABLE "ttlock_integrations"
  ADD CONSTRAINT "ttlock_integrations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ttlock_integrations"
  ADD CONSTRAINT "ttlock_integrations_configuredById_fkey"
  FOREIGN KEY ("configuredById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Smart lock enrichment (property_locks = smart_locks)
ALTER TABLE "property_locks" ADD COLUMN IF NOT EXISTS "gatewayId" TEXT;
ALTER TABLE "property_locks" ADD COLUMN IF NOT EXISTS "batteryLevel" INTEGER;
ALTER TABLE "property_locks" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

-- Access codes enrichment (access_credentials = access_codes)
CREATE TYPE "AccessCodeType" AS ENUM ('GUEST', 'OWNER', 'CLEANER', 'MAINTENANCE');

ALTER TABLE "access_credentials" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "access_credentials" ADD COLUMN IF NOT EXISTS "guestId" TEXT;
ALTER TABLE "access_credentials" ADD COLUMN IF NOT EXISTS "type" "AccessCodeType" NOT NULL DEFAULT 'GUEST';

CREATE INDEX IF NOT EXISTS "access_credentials_organizationId_idx"
  ON "access_credentials"("organizationId");

UPDATE "access_credentials" ac
SET "organizationId" = p."organizationId"
FROM "reservations" r
JOIN "properties" p ON p.id = r."propertyId"
WHERE ac."reservationId" = r.id
  AND ac."organizationId" IS NULL
  AND p."organizationId" IS NOT NULL;
