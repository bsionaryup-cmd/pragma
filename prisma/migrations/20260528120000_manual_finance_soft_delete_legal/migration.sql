-- Soft delete for manual finance entries + legal acceptance audit trail

ALTER TABLE "manual_expenses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "manual_expenses" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

ALTER TABLE "other_incomes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "other_incomes" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

CREATE INDEX IF NOT EXISTS "manual_expenses_deletedAt_idx" ON "manual_expenses"("deletedAt");
CREATE INDEX IF NOT EXISTS "other_incomes_deletedAt_idx" ON "other_incomes"("deletedAt");

DO $$ BEGIN
  ALTER TABLE "manual_expenses" ADD CONSTRAINT "manual_expenses_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "legal_document_acceptances" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "legal_document_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_document_acceptances_userId_idx" ON "legal_document_acceptances"("userId");
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_documentType_idx" ON "legal_document_acceptances"("documentType");
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_acceptedAt_idx" ON "legal_document_acceptances"("acceptedAt");

DO $$ BEGIN
  ALTER TABLE "legal_document_acceptances" ADD CONSTRAINT "legal_document_acceptances_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
