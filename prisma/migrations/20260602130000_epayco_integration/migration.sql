-- ePayco tenant integration (guest payment links)

CREATE TABLE "epayco_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicKey" TEXT,
    "privateKeyEncrypted" TEXT,
    "pKeyEncrypted" TEXT,
    "custIdCliente" TEXT,
    "env" TEXT NOT NULL DEFAULT 'test',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "preferForGuestPayments" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epayco_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "epayco_integrations_organizationId_key" ON "epayco_integrations"("organizationId");

ALTER TABLE "epayco_integrations" ADD CONSTRAINT "epayco_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "epayco_integrations" ADD CONSTRAINT "epayco_integrations_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guest_payment_links" ADD COLUMN "epaycoInvoice" TEXT,
ADD COLUMN "epaycoCheckoutUrl" TEXT,
ADD COLUMN "epaycoRefPayco" TEXT,
ADD COLUMN "paymentGateway" TEXT;

ALTER TYPE "PaymentProviderCode" ADD VALUE 'EPAYCO';
