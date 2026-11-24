-- AI Concierge native PRAGMA integration:
-- tenant-owned configuration, ephemeral extension linking, conversation
-- summaries, and persistent operational audit.

CREATE TYPE "ConciergeOperationMode" AS ENUM (
  'OBSERVE',
  'MANUAL',
  'ASSISTED',
  'AUTONOMOUS'
);

CREATE TYPE "ConciergeExtensionLinkStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'REVOKED'
);

CREATE TYPE "ConciergeConversationStatus" AS ENUM (
  'ACTIVE',
  'ESCALATED',
  'COMPLETED'
);

CREATE TABLE "concierge_configurations" (
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "mode" "ConciergeOperationMode" NOT NULL DEFAULT 'MANUAL',
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
  "airbnbEnabled" BOOLEAN NOT NULL DEFAULT true,
  "allowedPropertyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "allowedTools" JSONB NOT NULL DEFAULT '[]',
  "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
  "auditorEnabled" BOOLEAN NOT NULL DEFAULT true,
  "activeHours" JSONB,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "concierge_configurations_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "concierge_extension_links" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "linkedByUserId" TEXT NOT NULL,
  "deviceIdHash" TEXT,
  "pairingTokenHash" TEXT,
  "pairingExpiresAt" TIMESTAMP(3),
  "pairedAt" TIMESTAMP(3),
  "status" "ConciergeExtensionLinkStatus" NOT NULL DEFAULT 'PENDING',
  "version" TEXT,
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "concierge_extension_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "concierge_conversation_states" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "threadHash" TEXT NOT NULL,
  "status" "ConciergeConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "escalationCount" INTEGER NOT NULL DEFAULT 0,
  "deterministicCount" INTEGER NOT NULL DEFAULT 0,
  "llmCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "totalResponseMs" INTEGER NOT NULL DEFAULT 0,
  "lastIntent" TEXT,
  "lastPath" TEXT,
  "lastProcessedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "concierge_conversation_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "concierge_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "extensionLinkId" TEXT,
  "conversationStateId" TEXT,
  "runId" TEXT,
  "idempotencyKey" TEXT,
  "eventType" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "toolName" TEXT,
  "durationMs" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "concierge_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "concierge_extension_links_pairingTokenHash_key"
  ON "concierge_extension_links"("pairingTokenHash");
CREATE UNIQUE INDEX "concierge_extension_links_organizationId_deviceIdHash_key"
  ON "concierge_extension_links"("organizationId", "deviceIdHash");
CREATE INDEX "concierge_extension_links_organizationId_status_idx"
  ON "concierge_extension_links"("organizationId", "status");
CREATE INDEX "concierge_extension_links_lastHeartbeatAt_idx"
  ON "concierge_extension_links"("lastHeartbeatAt");

CREATE UNIQUE INDEX "concierge_conversation_states_organizationId_channel_threadHash_key"
  ON "concierge_conversation_states"("organizationId", "channel", "threadHash");
CREATE INDEX "concierge_conversation_states_organizationId_status_idx"
  ON "concierge_conversation_states"("organizationId", "status");
CREATE INDEX "concierge_conversation_states_organizationId_lastProcessedAt_idx"
  ON "concierge_conversation_states"("organizationId", "lastProcessedAt");

CREATE INDEX "concierge_audit_events_organizationId_createdAt_idx"
  ON "concierge_audit_events"("organizationId", "createdAt");
CREATE UNIQUE INDEX "concierge_audit_events_idempotencyKey_key"
  ON "concierge_audit_events"("idempotencyKey");
CREATE INDEX "concierge_audit_events_extensionLinkId_createdAt_idx"
  ON "concierge_audit_events"("extensionLinkId", "createdAt");
CREATE INDEX "concierge_audit_events_conversationStateId_createdAt_idx"
  ON "concierge_audit_events"("conversationStateId", "createdAt");

ALTER TABLE "concierge_configurations"
  ADD CONSTRAINT "concierge_configurations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concierge_configurations"
  ADD CONSTRAINT "concierge_configurations_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "concierge_extension_links"
  ADD CONSTRAINT "concierge_extension_links_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concierge_extension_links"
  ADD CONSTRAINT "concierge_extension_links_linkedByUserId_fkey"
  FOREIGN KEY ("linkedByUserId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "concierge_conversation_states"
  ADD CONSTRAINT "concierge_conversation_states_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "concierge_audit_events"
  ADD CONSTRAINT "concierge_audit_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "concierge_audit_events"
  ADD CONSTRAINT "concierge_audit_events_extensionLinkId_fkey"
  FOREIGN KEY ("extensionLinkId") REFERENCES "concierge_extension_links"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "concierge_audit_events"
  ADD CONSTRAINT "concierge_audit_events_conversationStateId_fkey"
  FOREIGN KEY ("conversationStateId") REFERENCES "concierge_conversation_states"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
