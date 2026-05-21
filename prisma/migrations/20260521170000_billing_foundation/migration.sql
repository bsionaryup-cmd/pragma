-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'LOCKED');

-- CreateEnum
CREATE TYPE "BillingPlanCode" AS ENUM ('STARTER', 'PRO');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'FAILED', 'VOID');

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" "BillingPlanCode" NOT NULL DEFAULT 'STARTER',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "billingLockedAt" TIMESTAMP(3),
    "wompiCustomerRef" TEXT,
    "defaultPaymentTokenRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL DEFAULT 'singleton',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "wompiTransactionId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_externalRef_key" ON "billing_invoices"("externalRef");

-- CreateIndex
CREATE INDEX "billing_invoices_billingAccountId_status_idx" ON "billing_invoices"("billingAccountId", "status");

-- CreateIndex
CREATE INDEX "billing_invoices_dueAt_idx" ON "billing_invoices"("dueAt");

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed trial account (14 days)
INSERT INTO "billing_accounts" ("id", "status", "plan", "trialEndsAt", "updatedAt")
VALUES (
  'singleton',
  'TRIAL',
  'STARTER',
  NOW() + INTERVAL '14 days',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
