-- AI Product Researcher + Media Buyer (additive)

DO $$ BEGIN
  CREATE TYPE "AiProductRecommendation" AS ENUM ('LAUNCH', 'WAIT', 'DISCARD', 'SCALE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiProductCandidateStatus" AS ENUM ('DRAFT', 'SCORED', 'HANDED_OFF', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiResearchRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiAgentHandoffStatus" AS ENUM ('PENDING', 'CLAIMED', 'DONE', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiMediaCampaignStatus" AS ENUM ('DRAFT', 'PAUSED', 'ACTIVE', 'COMPLETED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ai_product_researcher_configs" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "killSwitch" BOOLEAN NOT NULL DEFAULT true,
  "openaiKeyEncrypted" TEXT,
  "metaTokenEncrypted" TEXT,
  "dropiTokenEncrypted" TEXT,
  "dropiApiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.dropi.co',
  "scoreThreshold" INTEGER NOT NULL DEFAULT 85,
  "autoHandoff" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_product_researcher_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_product_research_runs" (
  "id" TEXT NOT NULL,
  "status" "AiResearchRunStatus" NOT NULL DEFAULT 'PENDING',
  "keywordsJson" JSONB,
  "notes" TEXT,
  "urlsJson" JSONB,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_product_research_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_product_research_runs_status_createdAt_idx"
  ON "ai_product_research_runs"("status", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ai_product_candidates" (
  "id" TEXT NOT NULL,
  "runId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "dropiProductId" TEXT,
  "scoreDemand" INTEGER NOT NULL DEFAULT 0,
  "scoreCompetition" INTEGER NOT NULL DEFAULT 0,
  "scoreVirality" INTEGER NOT NULL DEFAULT 0,
  "scoreImpulse" INTEGER NOT NULL DEFAULT 0,
  "scoreMargin" INTEGER NOT NULL DEFAULT 0,
  "scoreAdEase" INTEGER NOT NULL DEFAULT 0,
  "scoreWhatsapp" INTEGER NOT NULL DEFAULT 0,
  "scoreScale" INTEGER NOT NULL DEFAULT 0,
  "scoreTotal" INTEGER NOT NULL DEFAULT 0,
  "trendLevel" TEXT,
  "competitionLevel" TEXT,
  "recommendation" "AiProductRecommendation" NOT NULL DEFAULT 'WAIT',
  "status" "AiProductCandidateStatus" NOT NULL DEFAULT 'DRAFT',
  "reportJson" JSONB,
  "signalsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_product_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_product_candidates_scoreTotal_idx"
  ON "ai_product_candidates"("scoreTotal" DESC);
CREATE INDEX IF NOT EXISTS "ai_product_candidates_status_createdAt_idx"
  ON "ai_product_candidates"("status", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ai_agent_handoffs" (
  "id" TEXT NOT NULL,
  "fromAgent" TEXT NOT NULL,
  "toAgent" TEXT NOT NULL,
  "candidateId" TEXT,
  "status" "AiAgentHandoffStatus" NOT NULL DEFAULT 'PENDING',
  "payloadJson" JSONB,
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_agent_handoffs_toAgent_status_createdAt_idx"
  ON "ai_agent_handoffs"("toAgent", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "ai_media_buyer_configs" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "killSwitch" BOOLEAN NOT NULL DEFAULT true,
  "openaiKeyEncrypted" TEXT,
  "metaMarketingTokenEncrypted" TEXT,
  "metaAdAccountId" TEXT,
  "metaPageId" TEXT,
  "waPhoneNumberId" TEXT,
  "maxDailyBudget" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "autoPublish" BOOLEAN NOT NULL DEFAULT false,
  "autoOptimize" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_media_buyer_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_media_campaigns" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT,
  "handoffId" TEXT,
  "name" TEXT NOT NULL,
  "status" "AiMediaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "metaCampaignId" TEXT,
  "metaAdSetId" TEXT,
  "metaAdIdsJson" JSONB,
  "dailyBudget" DOUBLE PRECISION,
  "strategyJson" JSONB,
  "creativesJson" JSONB,
  "metricsJson" JSONB,
  "recommendationsJson" JSONB,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_media_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_media_campaigns_status_updatedAt_idx"
  ON "ai_media_campaigns"("status", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "ai_media_action_logs" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT,
  "action" TEXT NOT NULL,
  "detailJson" JSONB,
  "undoHint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_media_action_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_media_action_logs_createdAt_idx"
  ON "ai_media_action_logs"("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ai_media_insights" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT,
  "summary" TEXT NOT NULL,
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_media_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_media_insights_createdAt_idx"
  ON "ai_media_insights"("createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "ai_product_candidates"
    ADD CONSTRAINT "ai_product_candidates_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ai_product_research_runs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_agent_handoffs"
    ADD CONSTRAINT "ai_agent_handoffs_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "ai_product_candidates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_media_campaigns"
    ADD CONSTRAINT "ai_media_campaigns_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "ai_product_candidates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_media_action_logs"
    ADD CONSTRAINT "ai_media_action_logs_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "ai_media_campaigns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_media_insights"
    ADD CONSTRAINT "ai_media_insights_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "ai_media_campaigns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
