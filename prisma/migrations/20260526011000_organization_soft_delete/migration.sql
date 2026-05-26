-- Organization soft delete fields (owner operations)

BEGIN;

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedReason" TEXT;

CREATE INDEX IF NOT EXISTS "organizations_deletedAt_idx" ON "organizations" ("deletedAt");

COMMIT;

