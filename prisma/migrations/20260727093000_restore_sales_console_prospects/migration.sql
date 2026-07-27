-- Restore owner sales-console `prospects` after eradicate_non_pms_products dropped it.
-- Tenant `prospecting_leads` is intentionally NOT restored (retired product surface).

DO $$ BEGIN
  CREATE TYPE "ProspectStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'DEMO_BOOKED',
    'PROPOSAL',
    'CUSTOMER',
    'LOST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProspectSource" AS ENUM (
    'GOOGLE_MAPS',
    'AIRBNB',
    'INSTAGRAM',
    'LINKEDIN',
    'MANUAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProspectSegment" AS ENUM (
    'SHORT_TERM_OPERATOR',
    'PROPERTY_MANAGER',
    'CO_HOST',
    'INVESTOR',
    'HOTEL',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "prospects" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "city" TEXT,
    "estimatedProperties" INTEGER,
    "score" INTEGER,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "source" "ProspectSource" NOT NULL,
    "segment" "ProspectSegment" NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prospects_status_createdAt_idx" ON "prospects"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "prospects_city_idx" ON "prospects"("city");
CREATE INDEX IF NOT EXISTS "prospects_score_idx" ON "prospects"("score");
CREATE INDEX IF NOT EXISTS "prospects_source_idx" ON "prospects"("source");
CREATE INDEX IF NOT EXISTS "prospects_archived_idx" ON "prospects"("archived");
CREATE INDEX IF NOT EXISTS "prospects_companyName_idx" ON "prospects"("companyName");

DO $$ BEGIN
  ALTER TABLE "prospects" ADD CONSTRAINT "prospects_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure retired tenant table stays gone (idempotent).
DROP TABLE IF EXISTS "prospecting_leads" CASCADE;
DROP TYPE IF EXISTS "ProspectingLeadSource";
DROP TYPE IF EXISTS "ProspectingLeadStatus";
DROP TYPE IF EXISTS "ProspectingLeadType";
DROP TYPE IF EXISTS "ProspectingFitLevel";
