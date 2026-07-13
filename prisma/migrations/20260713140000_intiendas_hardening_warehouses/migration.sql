-- Additive INTIENDAS hardening: product image, transfer moves, warehouses
ALTER TYPE "RetailInventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER';

ALTER TABLE "retail_products" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

CREATE TABLE IF NOT EXISTS "retail_warehouses" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "RetailRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "retail_warehouse_stocks" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "retail_warehouse_stocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "retail_warehouses_storeId_status_idx" ON "retail_warehouses"("storeId", "status");
CREATE INDEX IF NOT EXISTS "retail_warehouses_storeId_name_idx" ON "retail_warehouses"("storeId", "name");
CREATE INDEX IF NOT EXISTS "retail_warehouses_deletedAt_idx" ON "retail_warehouses"("deletedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "retail_warehouse_stocks_warehouseId_productId_key" ON "retail_warehouse_stocks"("warehouseId", "productId");
CREATE INDEX IF NOT EXISTS "retail_warehouse_stocks_productId_idx" ON "retail_warehouse_stocks"("productId");

DO $$ BEGIN
  ALTER TABLE "retail_warehouses" ADD CONSTRAINT "retail_warehouses_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "retail_warehouse_stocks" ADD CONSTRAINT "retail_warehouse_stocks_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "retail_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "retail_warehouse_stocks" ADD CONSTRAINT "retail_warehouse_stocks_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "retail_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
