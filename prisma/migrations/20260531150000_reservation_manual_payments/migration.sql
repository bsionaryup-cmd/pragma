-- CreateEnum
CREATE TYPE "ReservationPaymentMethod" AS ENUM ('PAYMENT_LINK', 'CASH', 'BANK_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "organization_payment_method_configs" (
    "organizationId" TEXT NOT NULL,
    "methods" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_payment_method_configs_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "reservation_payments" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "method" "ReservationPaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "accountMethodId" TEXT,
    "receivedAt" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_payments_reservationId_receivedAt_idx" ON "reservation_payments"("reservationId", "receivedAt" DESC);

-- AddForeignKey
ALTER TABLE "organization_payment_method_configs" ADD CONSTRAINT "organization_payment_method_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_payments" ADD CONSTRAINT "reservation_payments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_payments" ADD CONSTRAINT "reservation_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
