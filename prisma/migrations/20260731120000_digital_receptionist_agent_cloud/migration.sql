-- Digital Receptionist Agent: Cloud API conversations, messages, turn queue, config extensions

ALTER TABLE "digital_receptionist_configs"
  ADD COLUMN IF NOT EXISTS "agentEngine" TEXT NOT NULL DEFAULT 'deterministic',
  ADD COLUMN IF NOT EXISTS "promptVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "whatsappPhoneNumberId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappBusinessAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappCloudEnabled" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "DigitalReceptionistConversationStatus" AS ENUM ('OPEN', 'ESCALATED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DigitalReceptionistTurnJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "digital_receptionist_conversations" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "threadKey" TEXT NOT NULL,
  "externalUserId" TEXT,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "status" "DigitalReceptionistConversationStatus" NOT NULL DEFAULT 'OPEN',
  "summaryText" TEXT,
  "reservationId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "digital_receptionist_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "digital_receptionist_conversations_organizationId_channel_threadKey_key"
  ON "digital_receptionist_conversations"("organizationId", "channel", "threadKey");

CREATE INDEX IF NOT EXISTS "digital_receptionist_conversations_organizationId_status_lastMessageAt_idx"
  ON "digital_receptionist_conversations"("organizationId", "status", "lastMessageAt" DESC);

CREATE TABLE IF NOT EXISTS "digital_receptionist_messages" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "externalMessageId" TEXT,
  "channelExternalKey" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "digital_receptionist_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "digital_receptionist_messages_organizationId_channelExternalKey_key"
  ON "digital_receptionist_messages"("organizationId", "channelExternalKey");

CREATE INDEX IF NOT EXISTS "digital_receptionist_messages_conversationId_createdAt_idx"
  ON "digital_receptionist_messages"("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "digital_receptionist_messages_organizationId_createdAt_idx"
  ON "digital_receptionist_messages"("organizationId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "digital_receptionist_turn_jobs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" "DigitalReceptionistTurnJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "digital_receptionist_turn_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "digital_receptionist_turn_jobs_status_runAfter_idx"
  ON "digital_receptionist_turn_jobs"("status", "runAfter");

CREATE INDEX IF NOT EXISTS "digital_receptionist_turn_jobs_organizationId_createdAt_idx"
  ON "digital_receptionist_turn_jobs"("organizationId", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "digital_receptionist_conversations"
    ADD CONSTRAINT "digital_receptionist_conversations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "digital_receptionist_messages"
    ADD CONSTRAINT "digital_receptionist_messages_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "digital_receptionist_messages"
    ADD CONSTRAINT "digital_receptionist_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "digital_receptionist_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "digital_receptionist_turn_jobs"
    ADD CONSTRAINT "digital_receptionist_turn_jobs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "digital_receptionist_turn_jobs"
    ADD CONSTRAINT "digital_receptionist_turn_jobs_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "digital_receptionist_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
