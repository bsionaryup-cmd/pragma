-- Dropshipping order hardening: controlled statuses + idempotent shopOrderId
-- Additive / non-destructive. Maps legacy CREATED → CONFIRMED.

DO $$ BEGIN
  CREATE TYPE "AiSalesOrderStatus" AS ENUM (
    'PENDING',
    'VALIDATING',
    'READY',
    'SUBMITTING',
    'SUBMITTED',
    'CONFIRMED',
    'FAILED_RETRYABLE',
    'FAILED_PERMANENT',
    'MANUAL_REVIEW',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ai_sales_order_logs"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Normalize legacy free-text statuses before enum cast
UPDATE "ai_sales_order_logs"
SET "status" = CASE
  WHEN upper("status") IN ('CREATED', 'SUBMITTED', 'CONFIRMED', 'SUCCESS', 'OK') THEN 'CONFIRMED'
  WHEN upper("status") IN ('FAILED', 'ERROR') THEN 'FAILED_PERMANENT'
  WHEN upper("status") IN ('PENDING', 'VALIDATING', 'READY', 'SUBMITTING', 'SUBMITTED', 'CONFIRMED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'MANUAL_REVIEW', 'CANCELLED') THEN upper("status")
  ELSE 'MANUAL_REVIEW'
END;

-- Convert status TEXT → enum (safe when already enum)
DO $$ BEGIN
  ALTER TABLE "ai_sales_order_logs"
    ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "ai_sales_order_logs"
    ALTER COLUMN "status" TYPE "AiSalesOrderStatus"
    USING ("status"::"AiSalesOrderStatus");
  ALTER TABLE "ai_sales_order_logs"
    ALTER COLUMN "status" SET DEFAULT 'PENDING'::"AiSalesOrderStatus";
EXCEPTION
  WHEN others THEN
    -- Column may already be the enum type
    NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_sales_order_logs_shopOrderId_key"
  ON "ai_sales_order_logs"("shopOrderId");

CREATE INDEX IF NOT EXISTS "ai_sales_order_logs_status_runAfter_idx"
  ON "ai_sales_order_logs"("status", "runAfter");

CREATE INDEX IF NOT EXISTS "ai_sales_order_logs_conversationId_status_idx"
  ON "ai_sales_order_logs"("conversationId", "status");
