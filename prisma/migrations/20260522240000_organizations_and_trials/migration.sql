-- Organizations for multi-account SaaS sign-up + per-org billing trials

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "properties" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "billing_accounts" ADD COLUMN "organizationId" TEXT;

INSERT INTO "organizations" ("id", "name", "createdAt", "updatedAt")
VALUES ('org_legacy_default', 'Cuenta principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "billing_accounts"
SET "organizationId" = 'org_legacy_default'
WHERE "id" = 'singleton';

UPDATE "users"
SET "organizationId" = 'org_legacy_default'
WHERE "organizationId" IS NULL;

UPDATE "properties"
SET "organizationId" = 'org_legacy_default'
WHERE "organizationId" IS NULL;

CREATE UNIQUE INDEX "billing_accounts_organizationId_key" ON "billing_accounts"("organizationId");
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "properties_organizationId_idx" ON "properties"("organizationId");

ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "properties" ADD CONSTRAINT "properties_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
