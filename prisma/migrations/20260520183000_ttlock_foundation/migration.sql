CREATE TYPE "TTLockIntegrationStatus" AS ENUM ('NOT_CONNECTED', 'PENDING_SETUP', 'CONNECTED', 'TOKEN_EXPIRED', 'SYNC_ERROR', 'READY');
CREATE TYPE "TTLockLockStatus" AS ENUM ('UNMAPPED', 'MAPPED', 'SYNCED', 'SYNC_ERROR');
CREATE TYPE "TTLockOnlineState" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE');
CREATE TYPE "TTLockExpirationStrategy" AS ENUM ('CHECKOUT_TIME', 'CHECKOUT_PLUS_BUFFER', 'MANUAL');
CREATE TYPE "AccessCredentialStatus" AS ENUM ('PENDING', 'GENERATED', 'SENT', 'ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "AccessCredentialDeliveryStatus" AS ENUM ('NOT_SENT', 'PENDING', 'SENT', 'FAILED');
CREATE TYPE "AccessEventType" AS ENUM ('TOKEN_REFRESHED', 'LOCK_SYNCED', 'LOCK_SYNC_FAILED', 'CODE_GENERATION_READY', 'CODE_GENERATED', 'CODE_REVOKED');

CREATE TABLE "ttlock_integrations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT,
  "clientSecretEncrypted" TEXT,
  "username" TEXT,
  "passwordHash" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "uid" TEXT,
  "expiresAt" TIMESTAMP(3),
  "status" "TTLockIntegrationStatus" NOT NULL DEFAULT 'PENDING_SETUP',
  "lastSyncedAt" TIMESTAMP(3),
  "lastTokenRefreshAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ttlock_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_locks" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "ttlockLockId" TEXT,
  "alias" TEXT,
  "timezone" TEXT,
  "lockStatus" "TTLockLockStatus" NOT NULL DEFAULT 'UNMAPPED',
  "onlineState" "TTLockOnlineState" NOT NULL DEFAULT 'UNKNOWN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "property_locks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ttlock_automation_settings" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "generateAfterGuestRegistration" BOOLEAN NOT NULL DEFAULT false,
  "revokeAfterCheckout" BOOLEAN NOT NULL DEFAULT true,
  "requireManualApproval" BOOLEAN NOT NULL DEFAULT true,
  "autoSendCode" BOOLEAN NOT NULL DEFAULT false,
  "allowRegeneration" BOOLEAN NOT NULL DEFAULT true,
  "expirationStrategy" "TTLockExpirationStrategy" NOT NULL DEFAULT 'CHECKOUT_TIME',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ttlock_automation_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_credentials" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "propertyLockId" TEXT,
  "ttlockCodeId" TEXT,
  "codeEncrypted" TEXT,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "status" "AccessCredentialStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryStatus" "AccessCredentialDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "access_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "access_events" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT,
  "integrationId" TEXT,
  "eventType" "AccessEventType" NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ttlock_integrations_userId_key" ON "ttlock_integrations"("userId");
CREATE INDEX "ttlock_integrations_status_idx" ON "ttlock_integrations"("status");
CREATE UNIQUE INDEX "property_locks_propertyId_key" ON "property_locks"("propertyId");
CREATE INDEX "property_locks_integrationId_idx" ON "property_locks"("integrationId");
CREATE INDEX "property_locks_ttlockLockId_idx" ON "property_locks"("ttlockLockId");
CREATE UNIQUE INDEX "ttlock_automation_settings_integrationId_key" ON "ttlock_automation_settings"("integrationId");
CREATE INDEX "access_credentials_reservationId_idx" ON "access_credentials"("reservationId");
CREATE INDEX "access_credentials_propertyLockId_idx" ON "access_credentials"("propertyLockId");
CREATE INDEX "access_credentials_status_idx" ON "access_credentials"("status");
CREATE INDEX "access_events_reservationId_idx" ON "access_events"("reservationId");
CREATE INDEX "access_events_integrationId_idx" ON "access_events"("integrationId");
CREATE INDEX "access_events_eventType_idx" ON "access_events"("eventType");

ALTER TABLE "ttlock_integrations"
  ADD CONSTRAINT "ttlock_integrations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_locks"
  ADD CONSTRAINT "property_locks_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "ttlock_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_locks"
  ADD CONSTRAINT "property_locks_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ttlock_automation_settings"
  ADD CONSTRAINT "ttlock_automation_settings_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "ttlock_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_credentials"
  ADD CONSTRAINT "access_credentials_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "access_credentials"
  ADD CONSTRAINT "access_credentials_propertyLockId_fkey"
  FOREIGN KEY ("propertyLockId") REFERENCES "property_locks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_events"
  ADD CONSTRAINT "access_events_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "access_events"
  ADD CONSTRAINT "access_events_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "ttlock_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
