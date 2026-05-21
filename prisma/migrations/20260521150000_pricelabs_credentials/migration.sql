-- Add optional encrypted integration credentials (DB override for env vars)
ALTER TABLE "pricelabs_integrations" ADD COLUMN IF NOT EXISTS "integrationTokenEncrypted" TEXT;
ALTER TABLE "pricelabs_integrations" ADD COLUMN IF NOT EXISTS "integrationName" TEXT;
