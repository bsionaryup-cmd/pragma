-- User onboarding + leads + manual payment fields

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "propertyCount" INTEGER;

UPDATE "users"
SET "onboardingCompletedAt" = NOW()
WHERE "role" = 'ADMIN' AND "onboardingCompletedAt" IS NULL;

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISCARDED');

CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "propertyCount" INTEGER,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_email_idx" ON "leads"("email");
CREATE INDEX "leads_status_createdAt_idx" ON "leads"("status", "createdAt");

ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "manualPaymentRef" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "manualPaymentNote" TEXT;
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "manualSubmittedAt" TIMESTAMP(3);
