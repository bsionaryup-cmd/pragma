-- Prospecting CRM workflow fields
CREATE TYPE "ProspectingLeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'RESPONDED',
  'INTERESTED',
  'FOLLOW_UP',
  'DEMO',
  'CUSTOMER',
  'NOT_INTERESTED',
  'ARCHIVED'
);

CREATE TYPE "ProspectingLeadType" AS ENUM (
  'PROPERTY_MANAGER',
  'CO_HOST',
  'HOST',
  'HOTEL',
  'HOSTEL',
  'VACATION_RENTAL_OPERATOR',
  'UNKNOWN'
);

CREATE TYPE "ProspectingFitLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "prospecting_leads"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "hostUrl" TEXT,
  ADD COLUMN "listingsCount" INTEGER,
  ADD COLUMN "status" "ProspectingLeadStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "lastContactDate" TIMESTAMP(3),
  ADD COLUMN "nextFollowUpDate" TIMESTAMP(3),
  ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "outreachMessage" TEXT,
  ADD COLUMN "leadType" "ProspectingLeadType",
  ADD COLUMN "estimatedSophistication" "ProspectingFitLevel",
  ADD COLUMN "potentialPragmaFit" "ProspectingFitLevel",
  ADD COLUMN "activityLog" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX "prospecting_leads_organizationId_status_idx"
  ON "prospecting_leads"("organizationId", "status");
