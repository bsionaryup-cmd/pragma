-- Airbnb Email Ingestion Layer (sidecar tables; iCal remains source of truth)

CREATE TYPE "AirbnbEmailProcessingStatus" AS ENUM ('RECEIVED', 'CLASSIFIED', 'PROCESSED', 'SKIPPED_DUPLICATE', 'FAILED', 'MANUAL_REVIEW');
CREATE TYPE "AirbnbEmailEventKind" AS ENUM ('CONFIRMED', 'CHECKIN_REMINDER', 'UPDATED', 'CANCELED', 'EXTENDED', 'PAYOUT_PROCESSED', 'RESERVATION_MESSAGE', 'HOST_REVIEW_REQUESTED', 'GUEST_REVIEW_SUBMITTED', 'GUEST_REVIEW_PUBLISHED', 'EARLY_CHECKIN_REQUEST', 'TRANSPORT_REQUEST', 'UNKNOWN');
CREATE TYPE "AirbnbEmailSenderChannel" AS ENUM ('AUTOMATED', 'EXPRESS', 'OTHER');
CREATE TYPE "AirbnbEmailMatchMethod" AS ENUM ('CONFIRMATION_CODE', 'LISTING_DATES', 'LISTING_GUEST_DATES', 'NONE');
CREATE TYPE "AirbnbEmailTaskKind" AS ENUM ('EARLY_CHECKIN_REQUEST', 'TRANSPORT_REQUEST', 'REVIEW_RESPONSE_PENDING', 'ORPHAN_EMAIL_EVENT', 'PAYOUT_MISMATCH', 'MANUAL_REVIEW');
CREATE TYPE "AirbnbEmailPayoutStatus" AS ENUM ('PROCESSED', 'PENDING', 'FAILED');
CREATE TYPE "AirbnbEmailReviewStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'PUBLISHED', 'RESPONSE_PENDING');

CREATE TABLE "email_ingestion_audit" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "contentHash" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT,
    "subject" TEXT NOT NULL,
    "senderChannel" "AirbnbEmailSenderChannel" NOT NULL DEFAULT 'OTHER',
    "rawEmail" JSONB NOT NULL,
    "classification" "AirbnbEmailEventKind",
    "processingStatus" "AirbnbEmailProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorReason" TEXT,
    "parsedPayload" JSONB,
    "organizationId" TEXT,
    "propertyId" TEXT,
    "reservationId" TEXT,
    "matchMethod" "AirbnbEmailMatchMethod",
    "matchConfidence" DECIMAL(5,4),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_ingestion_audit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservation_email_events" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "reservationId" TEXT,
    "eventKind" "AirbnbEmailEventKind" NOT NULL,
    "confirmationCode" TEXT,
    "matchMethod" "AirbnbEmailMatchMethod",
    "matchConfidence" DECIMAL(5,4),
    "payload" JSONB NOT NULL,
    "enrichedFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_email_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservation_payouts" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "reservationId" TEXT,
    "grossAmount" DECIMAL(12,2),
    "hostFee" DECIMAL(12,2),
    "netPayout" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "payoutStatus" "AirbnbEmailPayoutStatus" NOT NULL DEFAULT 'PROCESSED',
    "expectedSettlementAt" TIMESTAMP(3),
    "payoutAccountId" TEXT,
    "reconciliationStatus" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_payouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservation_communications" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "reservationId" TEXT,
    "senderType" TEXT,
    "threadId" TEXT,
    "rawMessage" TEXT NOT NULL,
    "parsedIntent" TEXT,
    "requiresAction" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_communications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservation_reviews" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "reservationId" TEXT,
    "rating" INTEGER,
    "reviewText" TEXT,
    "privateNote" TEXT,
    "responsePending" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "AirbnbEmailReviewStatus" NOT NULL DEFAULT 'REQUESTED',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "airbnb_email_tasks" (
    "id" TEXT NOT NULL,
    "auditId" TEXT,
    "reservationId" TEXT,
    "propertyId" TEXT,
    "kind" "AirbnbEmailTaskKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airbnb_email_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_ingestion_audit_messageId_key" ON "email_ingestion_audit"("messageId");
CREATE UNIQUE INDEX "email_ingestion_audit_contentHash_key" ON "email_ingestion_audit"("contentHash");
CREATE INDEX "email_ingestion_audit_processingStatus_createdAt_idx" ON "email_ingestion_audit"("processingStatus", "createdAt" DESC);
CREATE INDEX "email_ingestion_audit_reservationId_idx" ON "email_ingestion_audit"("reservationId");
CREATE INDEX "email_ingestion_audit_propertyId_idx" ON "email_ingestion_audit"("propertyId");

CREATE UNIQUE INDEX "reservation_email_events_auditId_key" ON "reservation_email_events"("auditId");
CREATE INDEX "reservation_email_events_reservationId_eventKind_idx" ON "reservation_email_events"("reservationId", "eventKind");
CREATE INDEX "reservation_email_events_confirmationCode_idx" ON "reservation_email_events"("confirmationCode");

CREATE UNIQUE INDEX "reservation_payouts_auditId_key" ON "reservation_payouts"("auditId");
CREATE INDEX "reservation_payouts_reservationId_idx" ON "reservation_payouts"("reservationId");

CREATE UNIQUE INDEX "reservation_communications_auditId_key" ON "reservation_communications"("auditId");
CREATE INDEX "reservation_communications_reservationId_threadId_idx" ON "reservation_communications"("reservationId", "threadId");

CREATE UNIQUE INDEX "reservation_reviews_auditId_key" ON "reservation_reviews"("auditId");
CREATE INDEX "reservation_reviews_reservationId_reviewStatus_idx" ON "reservation_reviews"("reservationId", "reviewStatus");

CREATE INDEX "airbnb_email_tasks_reservationId_status_idx" ON "airbnb_email_tasks"("reservationId", "status");
CREATE INDEX "airbnb_email_tasks_kind_status_idx" ON "airbnb_email_tasks"("kind", "status");

ALTER TABLE "email_ingestion_audit" ADD CONSTRAINT "email_ingestion_audit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_ingestion_audit" ADD CONSTRAINT "email_ingestion_audit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_email_events" ADD CONSTRAINT "reservation_email_events_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "email_ingestion_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_email_events" ADD CONSTRAINT "reservation_email_events_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_payouts" ADD CONSTRAINT "reservation_payouts_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "email_ingestion_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_payouts" ADD CONSTRAINT "reservation_payouts_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_communications" ADD CONSTRAINT "reservation_communications_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "email_ingestion_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_communications" ADD CONSTRAINT "reservation_communications_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_reviews" ADD CONSTRAINT "reservation_reviews_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "email_ingestion_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_reviews" ADD CONSTRAINT "reservation_reviews_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "airbnb_email_tasks" ADD CONSTRAINT "airbnb_email_tasks_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "email_ingestion_audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "airbnb_email_tasks" ADD CONSTRAINT "airbnb_email_tasks_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "airbnb_email_tasks" ADD CONSTRAINT "airbnb_email_tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
