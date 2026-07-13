-- PRAGMA INTIENDAS — retail account billing fields (additive)

CREATE TYPE "RetailAccessPlan" AS ENUM ('MONTHLY', 'LIFETIME');

ALTER TABLE "retail_stores" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "retail_stores" ADD COLUMN "accessPlan" "RetailAccessPlan" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "retail_stores" ADD COLUMN "billingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE INDEX "retail_stores_ownerUserId_idx" ON "retail_stores"("ownerUserId");
CREATE INDEX "retail_stores_accessPlan_idx" ON "retail_stores"("accessPlan");
