-- CreateEnum
CREATE TYPE "RetailIntelEventType" AS ENUM ('SALE_COMPLETED', 'SALE_CANCELLED', 'PURCHASE_RECEIVED', 'STOCK_ADJUSTED', 'STOCK_TRANSFERRED', 'PRODUCT_UPDATED', 'SUPPLIER_UPDATED', 'REFRESH_STORE_PLAN');

-- CreateEnum
CREATE TYPE "RetailIntelAction" AS ENUM ('BUY_NOW', 'BUY_SOON', 'WAIT', 'DO_NOT_REORDER', 'SWITCH_SUPPLIER', 'PROMOTE', 'INCREASE_STOCK_TARGET', 'DECREASE_STOCK_TARGET', 'OVERSTOCKED', 'NO_ROTATION', 'HIGH_ROTATION', 'CRITICAL', 'RUNNING_OUT');

-- CreateEnum
CREATE TYPE "RetailIntelOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "RetailDispatchChannel" AS ENUM ('EMAIL', 'PDF', 'WHATSAPP', 'WEB_LINK', 'API');

-- CreateEnum
CREATE TYPE "RetailIntelPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "retail_suppliers" ADD COLUMN IF NOT EXISTS "preferredDispatchChannel" "RetailDispatchChannel";

-- CreateTable
CREATE TABLE "retail_product_demand_days" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "qtySold" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_product_demand_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_product_intel_profiles" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "avgDailySales7" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avgDailySales14" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avgDailySales30" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avgDailySales90" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avgWeeklySales" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "avgMonthlySales" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "salesByMonthJson" JSONB,
    "salesByDowJson" JSONB,
    "demandTrendSlope" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "demandTrend" TEXT NOT NULL DEFAULT 'FLAT',
    "daysOfCover" DECIMAL(14,2),
    "daysToStockoutEst" INTEGER,
    "stockoutDays30" INTEGER NOT NULL DEFAULT 0,
    "grossMarginPct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "lastCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "suggestedReorderQty" INTEGER NOT NULL DEFAULT 0,
    "suggestedAction" "RetailIntelAction" NOT NULL DEFAULT 'WAIT',
    "priority" "RetailIntelPriority" NOT NULL DEFAULT 'LOW',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "abcClass" TEXT,
    "xyzClass" TEXT,
    "deadStockScore" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "recommendedBuyDate" TIMESTAMP(3),
    "estimatedStockoutDate" TIMESTAMP(3),
    "estimatedCoverageDays" INTEGER,
    "estimatedCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_product_intel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_supplier_intel_profiles" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "avgLeadTimeDaysObserved" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "leadTimeP50" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "leadTimeP90" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "preferredDeliveryDowsJson" JSONB,
    "onTimeRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "fillRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "orderFrequencyDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "lastOrderTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "avgOrderTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lifetimePurchaseTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reliabilityScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_supplier_intel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_intel_outbox" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "RetailIntelEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB,
    "status" "RetailIntelOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_intel_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_intel_reorder_plans" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_intel_reorder_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_intel_reorder_plan_lines" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "suggestedQty" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "action" "RetailIntelAction" NOT NULL,
    "priority" "RetailIntelPriority" NOT NULL DEFAULT 'MEDIUM',
    "daysOfCover" DECIMAL(14,2),
    "estimatedStockoutDate" TIMESTAMP(3),
    "recommendedBuyDate" TIMESTAMP(3),
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_intel_reorder_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_store_health_scores" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "inventoryHealth" INTEGER NOT NULL DEFAULT 0,
    "coverageScore" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "overstockCount" INTEGER NOT NULL DEFAULT 0,
    "marginScore" INTEGER NOT NULL DEFAULT 0,
    "deadStockCount" INTEGER NOT NULL DEFAULT 0,
    "supplierScore" INTEGER NOT NULL DEFAULT 0,
    "salesTrendScore" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_store_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_order_dispatch_jobs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT,
    "channel" "RetailDispatchChannel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "payloadJson" JSONB,
    "resultJson" JSONB,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_order_dispatch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_intel_feedback" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "suggestionId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_intel_feedback_pkey" PRIMARY KEY ("id")
);

-- Indexes & FKs
CREATE UNIQUE INDEX "retail_product_demand_days_productId_day_key" ON "retail_product_demand_days"("productId", "day");
CREATE INDEX "retail_product_demand_days_storeId_day_idx" ON "retail_product_demand_days"("storeId", "day");
CREATE INDEX "retail_product_demand_days_storeId_productId_day_idx" ON "retail_product_demand_days"("storeId", "productId", "day");

CREATE UNIQUE INDEX "retail_product_intel_profiles_productId_key" ON "retail_product_intel_profiles"("productId");
CREATE INDEX "retail_product_intel_profiles_storeId_suggestedAction_idx" ON "retail_product_intel_profiles"("storeId", "suggestedAction");
CREATE INDEX "retail_product_intel_profiles_storeId_priority_idx" ON "retail_product_intel_profiles"("storeId", "priority");
CREATE INDEX "retail_product_intel_profiles_storeId_computedAt_idx" ON "retail_product_intel_profiles"("storeId", "computedAt");

CREATE UNIQUE INDEX "retail_supplier_intel_profiles_supplierId_key" ON "retail_supplier_intel_profiles"("supplierId");
CREATE INDEX "retail_supplier_intel_profiles_storeId_reliabilityScore_idx" ON "retail_supplier_intel_profiles"("storeId", "reliabilityScore");
CREATE INDEX "retail_supplier_intel_profiles_storeId_computedAt_idx" ON "retail_supplier_intel_profiles"("storeId", "computedAt");

CREATE INDEX "retail_intel_outbox_status_createdAt_idx" ON "retail_intel_outbox"("status", "createdAt");
CREATE INDEX "retail_intel_outbox_storeId_status_createdAt_idx" ON "retail_intel_outbox"("storeId", "status", "createdAt");
CREATE INDEX "retail_intel_outbox_storeId_type_status_idx" ON "retail_intel_outbox"("storeId", "type", "status");

CREATE INDEX "retail_intel_reorder_plans_storeId_status_idx" ON "retail_intel_reorder_plans"("storeId", "status");
CREATE INDEX "retail_intel_reorder_plans_storeId_computedAt_idx" ON "retail_intel_reorder_plans"("storeId", "computedAt");

CREATE INDEX "retail_intel_reorder_plan_lines_planId_idx" ON "retail_intel_reorder_plan_lines"("planId");
CREATE INDEX "retail_intel_reorder_plan_lines_storeId_supplierId_idx" ON "retail_intel_reorder_plan_lines"("storeId", "supplierId");
CREATE INDEX "retail_intel_reorder_plan_lines_productId_idx" ON "retail_intel_reorder_plan_lines"("productId");

CREATE UNIQUE INDEX "retail_store_health_scores_storeId_key" ON "retail_store_health_scores"("storeId");
CREATE INDEX "retail_store_health_scores_storeId_computedAt_idx" ON "retail_store_health_scores"("storeId", "computedAt");

CREATE INDEX "retail_order_dispatch_jobs_storeId_status_idx" ON "retail_order_dispatch_jobs"("storeId", "status");
CREATE INDEX "retail_order_dispatch_jobs_purchaseOrderId_idx" ON "retail_order_dispatch_jobs"("purchaseOrderId");

CREATE INDEX "retail_intel_feedback_storeId_createdAt_idx" ON "retail_intel_feedback"("storeId", "createdAt");
CREATE INDEX "retail_intel_feedback_productId_idx" ON "retail_intel_feedback"("productId");

ALTER TABLE "retail_product_demand_days" ADD CONSTRAINT "retail_product_demand_days_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_product_demand_days" ADD CONSTRAINT "retail_product_demand_days_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retail_product_intel_profiles" ADD CONSTRAINT "retail_product_intel_profiles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_product_intel_profiles" ADD CONSTRAINT "retail_product_intel_profiles_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retail_supplier_intel_profiles" ADD CONSTRAINT "retail_supplier_intel_profiles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_supplier_intel_profiles" ADD CONSTRAINT "retail_supplier_intel_profiles_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "retail_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retail_intel_outbox" ADD CONSTRAINT "retail_intel_outbox_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retail_intel_reorder_plans" ADD CONSTRAINT "retail_intel_reorder_plans_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retail_intel_reorder_plan_lines" ADD CONSTRAINT "retail_intel_reorder_plan_lines_planId_fkey" FOREIGN KEY ("planId") REFERENCES "retail_intel_reorder_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_intel_reorder_plan_lines" ADD CONSTRAINT "retail_intel_reorder_plan_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_intel_reorder_plan_lines" ADD CONSTRAINT "retail_intel_reorder_plan_lines_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "retail_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retail_store_health_scores" ADD CONSTRAINT "retail_store_health_scores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "retail_order_dispatch_jobs" ADD CONSTRAINT "retail_order_dispatch_jobs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_order_dispatch_jobs" ADD CONSTRAINT "retail_order_dispatch_jobs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "retail_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "retail_intel_feedback" ADD CONSTRAINT "retail_intel_feedback_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_intel_feedback" ADD CONSTRAINT "retail_intel_feedback_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
