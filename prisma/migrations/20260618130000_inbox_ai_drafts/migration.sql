-- Inbox AI drafts and audit trail

CREATE TYPE "InboxAiDraftStatus" AS ENUM ('GENERATED', 'EDITED', 'DISCARDED');
CREATE TYPE "InboxAiDraftAuditAction" AS ENUM ('GENERATED', 'EDITED', 'COPIED', 'DISCARDED');

CREATE TABLE "inbox_ai_drafts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestMessageId" TEXT,
    "guestMessageBody" TEXT NOT NULL,
    "detectedIntent" TEXT NOT NULL,
    "intentConfidence" DECIMAL(5,4),
    "intentSource" TEXT,
    "contextSnapshot" JSONB NOT NULL,
    "generatedText" TEXT NOT NULL,
    "editedText" TEXT,
    "generationProvider" TEXT NOT NULL,
    "generationModel" TEXT,
    "status" "InboxAiDraftStatus" NOT NULL DEFAULT 'GENERATED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_ai_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbox_ai_draft_audit_events" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "action" "InboxAiDraftAuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_ai_draft_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inbox_ai_drafts_reservationId_createdAt_idx" ON "inbox_ai_drafts"("reservationId", "createdAt" DESC);
CREATE INDEX "inbox_ai_drafts_organizationId_createdAt_idx" ON "inbox_ai_drafts"("organizationId", "createdAt" DESC);
CREATE INDEX "inbox_ai_draft_audit_events_draftId_createdAt_idx" ON "inbox_ai_draft_audit_events"("draftId", "createdAt");

ALTER TABLE "inbox_ai_drafts" ADD CONSTRAINT "inbox_ai_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_ai_drafts" ADD CONSTRAINT "inbox_ai_drafts_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_ai_drafts" ADD CONSTRAINT "inbox_ai_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inbox_ai_draft_audit_events" ADD CONSTRAINT "inbox_ai_draft_audit_events_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "inbox_ai_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbox_ai_draft_audit_events" ADD CONSTRAINT "inbox_ai_draft_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
