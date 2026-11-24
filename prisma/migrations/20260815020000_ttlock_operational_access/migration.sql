CREATE TABLE "operational_access_credentials" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "propertyId" TEXT NOT NULL,
  "propertyLockId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "AccessCodeType" NOT NULL,
  "codeEncrypted" TEXT NOT NULL,
  "ttlockCodeId" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "status" "AccessCredentialStatus" NOT NULL DEFAULT 'PENDING',
  "lastError" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_access_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_access_credentials_idempotencyKey_key"
  ON "operational_access_credentials"("idempotencyKey");

CREATE UNIQUE INDEX "operational_access_credentials_propertyLockId_ttlockCodeId_key"
  ON "operational_access_credentials"("propertyLockId", "ttlockCodeId");

CREATE INDEX "operational_access_credentials_organizationId_status_validTo_idx"
  ON "operational_access_credentials"("organizationId", "status", "validTo");

CREATE INDEX "operational_access_credentials_propertyId_createdAt_idx"
  ON "operational_access_credentials"("propertyId", "createdAt" DESC);

CREATE INDEX "operational_access_credentials_propertyLockId_status_idx"
  ON "operational_access_credentials"("propertyLockId", "status");

ALTER TABLE "operational_access_credentials"
  ADD CONSTRAINT "operational_access_credentials_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operational_access_credentials"
  ADD CONSTRAINT "operational_access_credentials_propertyLockId_fkey"
  FOREIGN KEY ("propertyLockId") REFERENCES "property_locks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

