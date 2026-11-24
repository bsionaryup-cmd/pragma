-- AI Sales Agent MVP (additive; no PMS core FKs)

DO $$ BEGIN
  CREATE TYPE "AiSalesConversationStage" AS ENUM (
    'ICEBREAK', 'DISCOVERY', 'PAIN', 'PITCH', 'OBJECTIONS', 'CLOSE', 'SHIPPING', 'ORDERED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiSalesTurnJobStatus" AS ENUM (
    'PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ai_sales_agent_configs" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "killSwitch" BOOLEAN NOT NULL DEFAULT true,
  "openaiKeyEncrypted" TEXT,
  "waAccessTokenEncrypted" TEXT,
  "waPhoneNumberId" TEXT,
  "waBusinessAccountId" TEXT,
  "waVerifyTokenEncrypted" TEXT,
  "waAppSecretEncrypted" TEXT,
  "dropiTokenEncrypted" TEXT,
  "dropiApiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.dropi.co',
  "autoCreateOrder" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_sales_agent_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_sales_conversations" (
  "id" TEXT NOT NULL,
  "threadKey" TEXT NOT NULL,
  "waUserId" TEXT NOT NULL,
  "contactName" TEXT,
  "stage" "AiSalesConversationStage" NOT NULL DEFAULT 'ICEBREAK',
  "memoryJson" JSONB,
  "productInterest" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_sales_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_sales_conversations_threadKey_key"
  ON "ai_sales_conversations"("threadKey");
CREATE INDEX IF NOT EXISTS "ai_sales_conversations_waUserId_idx"
  ON "ai_sales_conversations"("waUserId");
CREATE INDEX IF NOT EXISTS "ai_sales_conversations_stage_lastMessageAt_idx"
  ON "ai_sales_conversations"("stage", "lastMessageAt" DESC);

CREATE TABLE IF NOT EXISTS "ai_sales_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "externalMessageId" TEXT,
  "channelExternalKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_sales_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_sales_messages_channelExternalKey_key"
  ON "ai_sales_messages"("channelExternalKey");
CREATE INDEX IF NOT EXISTS "ai_sales_messages_conversationId_createdAt_idx"
  ON "ai_sales_messages"("conversationId", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_sales_turn_jobs" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "status" "AiSalesTurnJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_sales_turn_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_sales_turn_jobs_status_runAfter_idx"
  ON "ai_sales_turn_jobs"("status", "runAfter");

CREATE TABLE IF NOT EXISTS "ai_sales_order_logs" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "dropiOrderId" TEXT,
  "shopOrderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "summaryJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_sales_order_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_sales_order_logs_createdAt_idx"
  ON "ai_sales_order_logs"("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ai_sales_audit_events" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "threadKey" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_sales_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_sales_audit_events_createdAt_idx"
  ON "ai_sales_audit_events"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ai_sales_audit_events_eventType_createdAt_idx"
  ON "ai_sales_audit_events"("eventType", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "ai_sales_messages"
    ADD CONSTRAINT "ai_sales_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ai_sales_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_sales_turn_jobs"
    ADD CONSTRAINT "ai_sales_turn_jobs_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ai_sales_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_sales_order_logs"
    ADD CONSTRAINT "ai_sales_order_logs_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ai_sales_conversations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
