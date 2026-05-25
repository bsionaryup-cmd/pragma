-- Support Center + tenant guest payment links (separate from SaaS billing)

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportTicketCategory" AS ENUM ('BUG', 'BILLING', 'RESERVATIONS', 'INTEGRATIONS', 'ACCESS', 'OTHER');

CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdById" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "routeContext" TEXT,
    "propertyId" TEXT,
    "reservationId" TEXT,
    "autoContext" JSONB,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorKind" TEXT NOT NULL DEFAULT 'tenant',
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "GuestPaymentLinkStatus" AS ENUM ('DRAFT', 'SENT', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "GuestPaymentCategory" AS ENUM ('RESERVATION_FULL', 'DEPOSIT', 'REMAINING_BALANCE', 'DAMAGE_FEE', 'CLEANING_FEE', 'LATE_CHECKOUT', 'EXTRA_SERVICES', 'MANUAL_OPERATIONAL');

CREATE TABLE "guest_payment_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reservationId" TEXT,
    "propertyId" TEXT,
    "guestName" TEXT,
    "category" "GuestPaymentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" "GuestPaymentLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "wompiLinkId" TEXT,
    "wompiCheckoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "paymentInvoiceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_payment_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_organizationId_status_createdAt_idx" ON "support_tickets"("organizationId", "status", "createdAt" DESC);
CREATE INDEX "support_tickets_createdById_createdAt_idx" ON "support_tickets"("createdById", "createdAt" DESC);
CREATE INDEX "support_messages_ticketId_createdAt_idx" ON "support_messages"("ticketId", "createdAt");

CREATE INDEX "guest_payment_links_organizationId_status_createdAt_idx" ON "guest_payment_links"("organizationId", "status", "createdAt" DESC);
CREATE INDEX "guest_payment_links_reservationId_idx" ON "guest_payment_links"("reservationId");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guest_payment_links" ADD CONSTRAINT "guest_payment_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_payment_links" ADD CONSTRAINT "guest_payment_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guest_payment_links" ADD CONSTRAINT "guest_payment_links_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guest_payment_links" ADD CONSTRAINT "guest_payment_links_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
