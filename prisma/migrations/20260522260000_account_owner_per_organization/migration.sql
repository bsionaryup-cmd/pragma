-- Account owner must be unique per organization, not globally.
-- Fixes signup failures when multiple tenants register (P2002 on isAccountOwner).

DROP INDEX IF EXISTS "users_single_account_owner_idx";

CREATE UNIQUE INDEX "users_organization_account_owner_idx"
ON "users" ("organizationId")
WHERE "isAccountOwner" = true AND "organizationId" IS NOT NULL;
