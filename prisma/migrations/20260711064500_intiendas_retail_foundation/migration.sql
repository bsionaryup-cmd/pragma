-- PRAGMA INTIENDAS — Retail foundation (additive only, zero PMS impact)

CREATE TYPE "RetailRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RetailProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');
CREATE TYPE "RetailSaleStatus" AS ENUM ('COMPLETED', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "RetailPaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'QR', 'CARD', 'CREDIT');
CREATE TYPE "RetailInventoryMovementType" AS ENUM ('INITIAL', 'SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'LOSS');
CREATE TYPE "RetailPurchaseOrderStatus" AS ENUM ('SUGGESTED', 'DRAFT', 'APPROVED', 'SENT', 'RECEIVED', 'CANCELLED');
CREATE TYPE "RetailCashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "RetailSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'DISMISSED');
CREATE TYPE "RetailSuggestionReason" AS ENUM ('OUT_OF_STOCK', 'LOW_STOCK', 'HIGH_ROTATION', 'SLOW_MOVING', 'EXPIRING', 'REORDER_CYCLE');

CREATE TABLE "retail_stores" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "createdByUserId" TEXT,
    "status" "RetailRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_categories" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RetailRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_suppliers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "lastPurchaseAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "RetailRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "categoryId" TEXT,
    "primarySupplierId" TEXT,
    "secondarySupplierId" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "idealStock" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "status" "RetailProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_supplier_products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "minPurchaseQty" INTEGER NOT NULL DEFAULT 1,
    "suggestedPurchaseQty" INTEGER NOT NULL DEFAULT 0,
    "lastPrice" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_supplier_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_cash_registers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RetailRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_cash_registers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_cash_sessions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "openedByUserId" TEXT,
    "openingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closingAmount" DECIMAL(14,2),
    "expectedAmount" DECIMAL(14,2),
    "status" "RetailCashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "retail_cash_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_customers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "documentId" TEXT,
    "phone" TEXT,
    "creditBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "RetailRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_sales" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "customerId" TEXT,
    "code" TEXT NOT NULL,
    "status" "RetailSaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentMethod" "RetailPaymentMethod" NOT NULL DEFAULT 'CASH',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "changeGiven" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "soldByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "retail_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_inventory_movements" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "RetailInventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2),
    "referenceId" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retail_inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_purchase_orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT,
    "code" TEXT NOT NULL,
    "status" "RetailPurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "retail_purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_customer_payments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "RetailPaymentMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retail_customer_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_purchase_suggestions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "suggestedQty" INTEGER NOT NULL,
    "reason" "RetailSuggestionReason" NOT NULL,
    "status" "RetailSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "daysOfStockRemaining" INTEGER,
    "averageDailySales" DECIMAL(14,4),
    "estimatedCost" DECIMAL(14,2),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_purchase_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retail_audit_logs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retail_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retail_stores_organizationId_key" ON "retail_stores"("organizationId");
CREATE INDEX "retail_stores_organizationId_idx" ON "retail_stores"("organizationId");
CREATE INDEX "retail_stores_deletedAt_idx" ON "retail_stores"("deletedAt");

CREATE INDEX "retail_categories_storeId_status_sortOrder_idx" ON "retail_categories"("storeId", "status", "sortOrder");
CREATE INDEX "retail_categories_storeId_name_idx" ON "retail_categories"("storeId", "name");
CREATE INDEX "retail_categories_deletedAt_idx" ON "retail_categories"("deletedAt");

CREATE INDEX "retail_suppliers_storeId_status_idx" ON "retail_suppliers"("storeId", "status");
CREATE INDEX "retail_suppliers_storeId_name_idx" ON "retail_suppliers"("storeId", "name");
CREATE INDEX "retail_suppliers_deletedAt_idx" ON "retail_suppliers"("deletedAt");

CREATE UNIQUE INDEX "retail_products_storeId_sku_key" ON "retail_products"("storeId", "sku");
CREATE UNIQUE INDEX "retail_products_storeId_barcode_key" ON "retail_products"("storeId", "barcode");
CREATE INDEX "retail_products_storeId_status_idx" ON "retail_products"("storeId", "status");
CREATE INDEX "retail_products_storeId_name_idx" ON "retail_products"("storeId", "name");
CREATE INDEX "retail_products_storeId_isFavorite_idx" ON "retail_products"("storeId", "isFavorite");
CREATE INDEX "retail_products_categoryId_idx" ON "retail_products"("categoryId");
CREATE INDEX "retail_products_deletedAt_idx" ON "retail_products"("deletedAt");

CREATE UNIQUE INDEX "retail_supplier_products_supplierId_productId_key" ON "retail_supplier_products"("supplierId", "productId");
CREATE INDEX "retail_supplier_products_productId_idx" ON "retail_supplier_products"("productId");

CREATE INDEX "retail_cash_registers_storeId_status_idx" ON "retail_cash_registers"("storeId", "status");
CREATE INDEX "retail_cash_sessions_storeId_status_idx" ON "retail_cash_sessions"("storeId", "status");
CREATE INDEX "retail_cash_sessions_registerId_status_idx" ON "retail_cash_sessions"("registerId", "status");

CREATE INDEX "retail_customers_storeId_status_idx" ON "retail_customers"("storeId", "status");
CREATE INDEX "retail_customers_storeId_name_idx" ON "retail_customers"("storeId", "name");
CREATE INDEX "retail_customers_deletedAt_idx" ON "retail_customers"("deletedAt");

CREATE UNIQUE INDEX "retail_sales_storeId_code_key" ON "retail_sales"("storeId", "code");
CREATE INDEX "retail_sales_storeId_status_createdAt_idx" ON "retail_sales"("storeId", "status", "createdAt");
CREATE INDEX "retail_sales_storeId_createdAt_idx" ON "retail_sales"("storeId", "createdAt");
CREATE INDEX "retail_sales_customerId_idx" ON "retail_sales"("customerId");
CREATE INDEX "retail_sales_cashSessionId_idx" ON "retail_sales"("cashSessionId");

CREATE INDEX "retail_sale_items_saleId_idx" ON "retail_sale_items"("saleId");
CREATE INDEX "retail_sale_items_productId_idx" ON "retail_sale_items"("productId");

CREATE INDEX "retail_inventory_movements_storeId_createdAt_idx" ON "retail_inventory_movements"("storeId", "createdAt");
CREATE INDEX "retail_inventory_movements_productId_createdAt_idx" ON "retail_inventory_movements"("productId", "createdAt");
CREATE INDEX "retail_inventory_movements_type_idx" ON "retail_inventory_movements"("type");

CREATE UNIQUE INDEX "retail_purchase_orders_storeId_code_key" ON "retail_purchase_orders"("storeId", "code");
CREATE INDEX "retail_purchase_orders_storeId_status_createdAt_idx" ON "retail_purchase_orders"("storeId", "status", "createdAt");
CREATE INDEX "retail_purchase_orders_supplierId_idx" ON "retail_purchase_orders"("supplierId");

CREATE INDEX "retail_purchase_order_items_purchaseOrderId_idx" ON "retail_purchase_order_items"("purchaseOrderId");
CREATE INDEX "retail_purchase_order_items_productId_idx" ON "retail_purchase_order_items"("productId");

CREATE INDEX "retail_customer_payments_storeId_createdAt_idx" ON "retail_customer_payments"("storeId", "createdAt");
CREATE INDEX "retail_customer_payments_customerId_createdAt_idx" ON "retail_customer_payments"("customerId", "createdAt");

CREATE INDEX "retail_purchase_suggestions_storeId_status_idx" ON "retail_purchase_suggestions"("storeId", "status");
CREATE INDEX "retail_purchase_suggestions_productId_idx" ON "retail_purchase_suggestions"("productId");
CREATE INDEX "retail_purchase_suggestions_supplierId_idx" ON "retail_purchase_suggestions"("supplierId");

CREATE INDEX "retail_audit_logs_storeId_createdAt_idx" ON "retail_audit_logs"("storeId", "createdAt");
CREATE INDEX "retail_audit_logs_entityType_entityId_idx" ON "retail_audit_logs"("entityType", "entityId");

ALTER TABLE "retail_categories" ADD CONSTRAINT "retail_categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_suppliers" ADD CONSTRAINT "retail_suppliers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_products" ADD CONSTRAINT "retail_products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_products" ADD CONSTRAINT "retail_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "retail_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_products" ADD CONSTRAINT "retail_products_primarySupplierId_fkey" FOREIGN KEY ("primarySupplierId") REFERENCES "retail_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_products" ADD CONSTRAINT "retail_products_secondarySupplierId_fkey" FOREIGN KEY ("secondarySupplierId") REFERENCES "retail_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_supplier_products" ADD CONSTRAINT "retail_supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "retail_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_supplier_products" ADD CONSTRAINT "retail_supplier_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_cash_registers" ADD CONSTRAINT "retail_cash_registers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_cash_sessions" ADD CONSTRAINT "retail_cash_sessions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_cash_sessions" ADD CONSTRAINT "retail_cash_sessions_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "retail_cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_customers" ADD CONSTRAINT "retail_customers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_sales" ADD CONSTRAINT "retail_sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_sales" ADD CONSTRAINT "retail_sales_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "retail_cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_sales" ADD CONSTRAINT "retail_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "retail_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_sale_items" ADD CONSTRAINT "retail_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "retail_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_sale_items" ADD CONSTRAINT "retail_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_inventory_movements" ADD CONSTRAINT "retail_inventory_movements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_inventory_movements" ADD CONSTRAINT "retail_inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_purchase_orders" ADD CONSTRAINT "retail_purchase_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_purchase_orders" ADD CONSTRAINT "retail_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "retail_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_purchase_order_items" ADD CONSTRAINT "retail_purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "retail_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_purchase_order_items" ADD CONSTRAINT "retail_purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "retail_customer_payments" ADD CONSTRAINT "retail_customer_payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_customer_payments" ADD CONSTRAINT "retail_customer_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "retail_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_purchase_suggestions" ADD CONSTRAINT "retail_purchase_suggestions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_purchase_suggestions" ADD CONSTRAINT "retail_purchase_suggestions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_audit_logs" ADD CONSTRAINT "retail_audit_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
