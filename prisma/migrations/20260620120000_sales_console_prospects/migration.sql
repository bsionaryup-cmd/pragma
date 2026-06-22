-- Sales Console — Outbound CRM prospects (platform owner only)
-- Distinct from sales_quotes (SaaS offers) and leads (inbound landing)

CREATE TYPE "ProspectStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DEMO_BOOKED',
  'PROPOSAL',
  'CUSTOMER',
  'LOST'
);

CREATE TYPE "ProspectSource" AS ENUM (
  'GOOGLE_MAPS',
  'AIRBNB',
  'INSTAGRAM',
  'LINKEDIN',
  'MANUAL'
);

CREATE TYPE "ProspectSegment" AS ENUM (
  'SHORT_TERM_OPERATOR',
  'PROPERTY_MANAGER',
  'CO_HOST',
  'INVESTOR',
  'HOTEL',
  'OTHER'
);

CREATE TABLE "prospects" (
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

CREATE INDEX "prospects_status_createdAt_idx" ON "prospects"("status", "createdAt" DESC);
CREATE INDEX "prospects_city_idx" ON "prospects"("city");
CREATE INDEX "prospects_score_idx" ON "prospects"("score");
CREATE INDEX "prospects_source_idx" ON "prospects"("source");
CREATE INDEX "prospects_archived_idx" ON "prospects"("archived");
CREATE INDEX "prospects_companyName_idx" ON "prospects"("companyName");

ALTER TABLE "prospects" ADD CONSTRAINT "prospects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
