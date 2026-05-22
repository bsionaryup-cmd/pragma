-- Track billing receipt email delivery (Resend) for idempotent sends
ALTER TABLE "billing_invoices" ADD COLUMN "invoiceEmailSentAt" TIMESTAMP(3);
