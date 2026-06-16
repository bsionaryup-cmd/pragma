-- CreateEnum
CREATE TYPE "AirbnbEmailLinkageRelocationStatus" AS ENUM ('PENDING', 'APPLIED', 'SKIPPED', 'REVERTED');

-- CreateEnum
CREATE TYPE "AirbnbEmailLinkageRepairReason" AS ENUM ('CONFIRMATION_CODE_TARGET_MISMATCH');

-- CreateEnum
CREATE TYPE "AirbnbFinancialBackfillStatus" AS ENUM ('APPLIED', 'SKIPPED');

-- CreateTable
CREATE TABLE "airbnb_email_linkage_relocations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "confirmationCode" TEXT,
    "fromReservationId" TEXT NOT NULL,
    "toReservationId" TEXT NOT NULL,
    "reason" "AirbnbEmailLinkageRepairReason" NOT NULL,
    "previousState" JSONB NOT NULL,
    "status" "AirbnbEmailLinkageRelocationStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "revertedByRunId" TEXT,

    CONSTRAINT "airbnb_email_linkage_relocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airbnb_reservation_code_assignments" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "assignedCode" TEXT NOT NULL,
    "sourceAuditId" TEXT NOT NULL,
    "previousCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airbnb_reservation_code_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airbnb_financial_backfill_logs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "sourceAuditId" TEXT,
    "previousTotalAmount" DECIMAL(12,2) NOT NULL,
    "appliedTotalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT,
    "pickSource" TEXT,
    "status" "AirbnbFinancialBackfillStatus" NOT NULL,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airbnb_financial_backfill_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "airbnb_email_linkage_relocations_runId_idx" ON "airbnb_email_linkage_relocations"("runId");

-- CreateIndex
CREATE INDEX "airbnb_email_linkage_relocations_eventId_idx" ON "airbnb_email_linkage_relocations"("eventId");

-- CreateIndex
CREATE INDEX "airbnb_email_linkage_relocations_auditId_idx" ON "airbnb_email_linkage_relocations"("auditId");

-- CreateIndex
CREATE INDEX "airbnb_email_linkage_relocations_confirmationCode_idx" ON "airbnb_email_linkage_relocations"("confirmationCode");

-- CreateIndex
CREATE INDEX "airbnb_email_linkage_relocations_status_idx" ON "airbnb_email_linkage_relocations"("status");

-- CreateIndex
CREATE INDEX "airbnb_reservation_code_assignments_runId_idx" ON "airbnb_reservation_code_assignments"("runId");

-- CreateIndex
CREATE INDEX "airbnb_reservation_code_assignments_reservationId_idx" ON "airbnb_reservation_code_assignments"("reservationId");

-- CreateIndex
CREATE INDEX "airbnb_reservation_code_assignments_assignedCode_idx" ON "airbnb_reservation_code_assignments"("assignedCode");

-- CreateIndex
CREATE INDEX "airbnb_financial_backfill_logs_runId_idx" ON "airbnb_financial_backfill_logs"("runId");

-- CreateIndex
CREATE INDEX "airbnb_financial_backfill_logs_reservationId_idx" ON "airbnb_financial_backfill_logs"("reservationId");

-- CreateIndex
CREATE INDEX "airbnb_financial_backfill_logs_status_idx" ON "airbnb_financial_backfill_logs"("status");
