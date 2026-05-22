-- Payment ledger (PSP-agnostic, Wompi-ready)

CREATE TYPE "PaymentProviderCode" AS ENUM ('WOMPI', 'STRIPE', 'MERCADOPAGO', 'PAYU', 'MANUAL');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "PaymentInvoiceLedgerStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'FAILED', 'VOID', 'CANCELLED');
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'PSE', 'NEQUI', 'TRANSFER', 'OTHER');
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'APPROVED', 'FAILED');

CREATE TABLE "payment_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'singleton',
    "billingInvoiceId" TEXT,
    "reservationId" TEXT,
    "guestId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "PaymentInvoiceLedgerStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'singleton',
    "reservationId" TEXT,
    "invoiceId" TEXT,
    "guestId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "paymentMethod" "PaymentMethodType" NOT NULL DEFAULT 'OTHER',
    "provider" "PaymentProviderCode" NOT NULL DEFAULT 'WOMPI',
    "providerReference" TEXT,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'singleton',
    "invoiceId" TEXT NOT NULL,
    "transactionId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "provider" "PaymentProviderCode" NOT NULL DEFAULT 'WOMPI',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'singleton',
    "invoiceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProviderCode" NOT NULL DEFAULT 'WOMPI',
    "providerReference" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_webhook_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'singleton',
    "provider" "PaymentProviderCode" NOT NULL DEFAULT 'WOMPI',
    "eventType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_webhook_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'singleton',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_transactions_idempotencyKey_key" ON "payment_transactions"("idempotencyKey");
CREATE UNIQUE INDEX "payment_webhook_logs_provider_eventId_key" ON "payment_webhook_logs"("provider", "eventId");

CREATE INDEX "payment_invoices_tenantId_status_idx" ON "payment_invoices"("tenantId", "status");
CREATE INDEX "payment_invoices_billingInvoiceId_idx" ON "payment_invoices"("billingInvoiceId");
CREATE INDEX "payment_invoices_reservationId_idx" ON "payment_invoices"("reservationId");
CREATE INDEX "payment_invoices_dueAt_idx" ON "payment_invoices"("dueAt");

CREATE INDEX "payment_transactions_tenantId_status_idx" ON "payment_transactions"("tenantId", "status");
CREATE INDEX "payment_transactions_provider_providerReference_idx" ON "payment_transactions"("provider", "providerReference");
CREATE INDEX "payment_transactions_invoiceId_idx" ON "payment_transactions"("invoiceId");
CREATE INDEX "payment_transactions_reservationId_idx" ON "payment_transactions"("reservationId");
CREATE INDEX "payment_transactions_createdAt_idx" ON "payment_transactions"("createdAt");

CREATE INDEX "payment_attempts_invoiceId_attemptNumber_idx" ON "payment_attempts"("invoiceId", "attemptNumber");
CREATE INDEX "payment_attempts_tenantId_status_idx" ON "payment_attempts"("tenantId", "status");

CREATE INDEX "payment_refunds_invoiceId_idx" ON "payment_refunds"("invoiceId");
CREATE INDEX "payment_refunds_transactionId_idx" ON "payment_refunds"("transactionId");
CREATE INDEX "payment_refunds_tenantId_status_idx" ON "payment_refunds"("tenantId", "status");

CREATE INDEX "payment_webhook_logs_tenantId_createdAt_idx" ON "payment_webhook_logs"("tenantId", "createdAt");
CREATE INDEX "payment_webhook_logs_processed_idx" ON "payment_webhook_logs"("processed");

CREATE INDEX "payment_audit_logs_tenantId_entityType_entityId_idx" ON "payment_audit_logs"("tenantId", "entityType", "entityId");
CREATE INDEX "payment_audit_logs_createdAt_idx" ON "payment_audit_logs"("createdAt");

ALTER TABLE "payment_invoices" ADD CONSTRAINT "payment_invoices_billingInvoiceId_fkey" FOREIGN KEY ("billingInvoiceId") REFERENCES "billing_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_invoices" ADD CONSTRAINT "payment_invoices_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "payment_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "payment_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "payment_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
