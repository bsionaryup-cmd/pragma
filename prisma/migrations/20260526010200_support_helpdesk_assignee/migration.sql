-- Support Helpdesk: add assignee for platform operations

BEGIN;

ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;

-- FK to users; platform/tenant user record (SUPER_ADMIN_OWNER) can be assignee.
DO $$ BEGIN
  ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "support_tickets_assignedToId_status_updatedAt_idx"
  ON "support_tickets" ("assignedToId", "status", "updatedAt" DESC);

COMMIT;

