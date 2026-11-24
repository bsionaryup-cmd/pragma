-- Recepcionista Digital: configuration only (no runtime).
-- Default status OFF; skills stored as JSON allowlist.

CREATE TYPE "DigitalReceptionistStatus" AS ENUM ('OFF', 'CONFIG_ONLY', 'SUPERVISED', 'AUTONOMOUS');

CREATE TABLE "digital_receptionist_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DigitalReceptionistStatus" NOT NULL DEFAULT 'OFF',
    "channelWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "channelAirbnb" BOOLEAN NOT NULL DEFAULT false,
    "skills" JSONB NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'cercano',
    "emojiLevel" TEXT NOT NULL DEFAULT 'light',
    "replyLength" TEXT NOT NULL DEFAULT 'corto',
    "languages" JSONB NOT NULL DEFAULT '["es"]',
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "businessHoursJson" JSONB,
    "ownerNotes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_receptionist_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "digital_receptionist_configs_organizationId_key" ON "digital_receptionist_configs"("organizationId");
CREATE INDEX "digital_receptionist_configs_status_idx" ON "digital_receptionist_configs"("status");

ALTER TABLE "digital_receptionist_configs"
  ADD CONSTRAINT "digital_receptionist_configs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "digital_receptionist_configs"
  ADD CONSTRAINT "digital_receptionist_configs_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
