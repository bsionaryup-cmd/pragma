-- Wompi credentials (encrypted secrets + public key for Facturación UI)

CREATE TABLE "wompi_integrations" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "publicKey" TEXT,
    "privateKeyEncrypted" TEXT,
    "eventsSecretEncrypted" TEXT,
    "integritySecretEncrypted" TEXT,
    "env" TEXT NOT NULL DEFAULT 'test',
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wompi_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wompi_integrations_configuredById_key" ON "wompi_integrations"("configuredById");

ALTER TABLE "wompi_integrations" ADD CONSTRAINT "wompi_integrations_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
