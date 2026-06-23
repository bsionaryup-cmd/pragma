-- CreateEnum
CREATE TYPE "ProspectingLeadSource" AS ENUM ('GOOGLE_MAPS', 'AIRBNB', 'INSTAGRAM', 'FACEBOOK', 'BOOKING', 'LINKEDIN');

-- CreateTable
CREATE TABLE "prospecting_leads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "email" TEXT,
    "address" TEXT,
    "rating" DOUBLE PRECISION,
    "reviews" INTEGER,
    "category" TEXT,
    "source" "ProspectingLeadSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospecting_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prospecting_leads_organizationId_createdAt_idx" ON "prospecting_leads"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "prospecting_leads_organizationId_businessName_idx" ON "prospecting_leads"("organizationId", "businessName");

-- CreateIndex
CREATE INDEX "prospecting_leads_source_idx" ON "prospecting_leads"("source");

-- AddForeignKey
ALTER TABLE "prospecting_leads" ADD CONSTRAINT "prospecting_leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
