-- Sales Console: quotes, events, discount codes (SaaS offers — isolated from guest payments)

CREATE TYPE "SalesQuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'CONVERTED');
CREATE TYPE "SalesBillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SalesDiscountScope" AS ENUM ('GLOBAL', 'PLAN', 'TENANT');
CREATE TYPE "SalesDiscountKind" AS ENUM ('PERCENT', 'FIXED_COP');

CREATE TABLE "sales_discount_codes" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "kind" "SalesDiscountKind" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "scope" "SalesDiscountScope" NOT NULL DEFAULT 'GLOBAL',
    "plan" "BillingPlanCode",
    "organizationId" TEXT,
    "firstMonthOnly" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_discount_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_discount_codes_code_key" ON "sales_discount_codes"("code");
CREATE INDEX "sales_discount_codes_active_expiresAt_idx" ON "sales_discount_codes"("active", "expiresAt");

CREATE TABLE "sales_quotes" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "organizationId" TEXT,
    "prospectName" TEXT,
    "prospectEmail" TEXT,
    "plan" "BillingPlanCode" NOT NULL,
    "propertyCount" INTEGER NOT NULL,
    "billingInterval" "SalesBillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "discountPercent" DECIMAL(5,2),
    "discountAmountCop" DECIMAL(12,2),
    "discountCodeId" TEXT,
    "listAmountCop" DECIMAL(12,2) NOT NULL,
    "savingsAmountCop" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalAmountCop" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "SalesQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "offerToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_quotes_offerToken_key" ON "sales_quotes"("offerToken");
CREATE INDEX "sales_quotes_status_createdAt_idx" ON "sales_quotes"("status", "createdAt" DESC);
CREATE INDEX "sales_quotes_prospectEmail_idx" ON "sales_quotes"("prospectEmail");
CREATE INDEX "sales_quotes_organizationId_idx" ON "sales_quotes"("organizationId");

CREATE TABLE "sales_quote_events" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_quote_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_quote_events_quoteId_createdAt_idx" ON "sales_quote_events"("quoteId", "createdAt");

ALTER TABLE "sales_discount_codes" ADD CONSTRAINT "sales_discount_codes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "sales_discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_quote_events" ADD CONSTRAINT "sales_quote_events_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "sales_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_quote_events" ADD CONSTRAINT "sales_quote_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
