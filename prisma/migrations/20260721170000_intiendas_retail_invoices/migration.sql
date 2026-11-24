-- PRAGMA INTIENDAS — retail invoices (thin layer over RetailSale) + store fiscal fields

CREATE TYPE "RetailInvoiceStatus" AS ENUM ('ISSUED', 'VOID');

ALTER TABLE "retail_stores" ADD COLUMN "legalName" TEXT;
ALTER TABLE "retail_stores" ADD COLUMN "taxId" TEXT;
ALTER TABLE "retail_stores" ADD COLUMN "address" TEXT;
ALTER TABLE "retail_stores" ADD COLUMN "phone" TEXT;
ALTER TABLE "retail_stores" ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'FV';
ALTER TABLE "retail_stores" ADD COLUMN "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "retail_invoices" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "RetailInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issuerName" TEXT NOT NULL,
    "issuerTaxId" TEXT,
    "issuerAddress" TEXT,
    "issuerPhone" TEXT,
    "buyerName" TEXT,
    "buyerTaxId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retail_invoices_saleId_key" ON "retail_invoices"("saleId");
CREATE UNIQUE INDEX "retail_invoices_storeId_number_key" ON "retail_invoices"("storeId", "number");
CREATE INDEX "retail_invoices_storeId_issuedAt_idx" ON "retail_invoices"("storeId", "issuedAt");
CREATE INDEX "retail_invoices_storeId_status_idx" ON "retail_invoices"("storeId", "status");

ALTER TABLE "retail_invoices" ADD CONSTRAINT "retail_invoices_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "retail_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retail_invoices" ADD CONSTRAINT "retail_invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "retail_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
