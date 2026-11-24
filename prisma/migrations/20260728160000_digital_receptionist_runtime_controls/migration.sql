-- Recepcionista Digital: kill switch, runtime token, audit + outbound ledger

ALTER TABLE "digital_receptionist_configs"
  ADD COLUMN IF NOT EXISTS "killSwitch" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "runtimeAgentTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "runtimeLastSeenAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "digital_receptionist_audit_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "configId" TEXT,
    "channel" TEXT NOT NULL,
    "threadKey" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "digital_receptionist_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "digital_receptionist_audit_events_organizationId_createdAt_idx"
  ON "digital_receptionist_audit_events"("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "digital_receptionist_audit_events_organizationId_eventType_createdAt_idx"
  ON "digital_receptionist_audit_events"("organizationId", "eventType", "createdAt" DESC);

ALTER TABLE "digital_receptionist_audit_events"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_audit_events_organizationId_fkey";
ALTER TABLE "digital_receptionist_audit_events"
  ADD CONSTRAINT "digital_receptionist_audit_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "digital_receptionist_audit_events"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_audit_events_configId_fkey";
ALTER TABLE "digital_receptionist_audit_events"
  ADD CONSTRAINT "digital_receptionist_audit_events_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "digital_receptionist_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "digital_receptionist_outbound_ledger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "configId" TEXT,
    "channel" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "replyPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "digital_receptionist_outbound_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "digital_receptionist_outbound_ledger_org_channel_fp_key"
  ON "digital_receptionist_outbound_ledger"("organizationId", "channel", "fingerprint");
CREATE INDEX IF NOT EXISTS "digital_receptionist_outbound_ledger_organizationId_createdAt_idx"
  ON "digital_receptionist_outbound_ledger"("organizationId", "createdAt" DESC);

ALTER TABLE "digital_receptionist_outbound_ledger"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_outbound_ledger_organizationId_fkey";
ALTER TABLE "digital_receptionist_outbound_ledger"
  ADD CONSTRAINT "digital_receptionist_outbound_ledger_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "digital_receptionist_outbound_ledger"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_outbound_ledger_configId_fkey";
ALTER TABLE "digital_receptionist_outbound_ledger"
  ADD CONSTRAINT "digital_receptionist_outbound_ledger_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "digital_receptionist_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
