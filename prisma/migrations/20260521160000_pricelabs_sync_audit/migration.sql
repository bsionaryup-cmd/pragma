ALTER TABLE "pricelabs_integrations" ADD COLUMN IF NOT EXISTS "syncInProgressAt" TIMESTAMP(3);
ALTER TABLE "pricelabs_integrations" ADD COLUMN IF NOT EXISTS "neighborhoodSnapshot" JSONB;

CREATE TABLE IF NOT EXISTS "pricelabs_sync_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pricelabs_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pricelabs_sync_logs_createdAt_idx" ON "pricelabs_sync_logs"("createdAt");
