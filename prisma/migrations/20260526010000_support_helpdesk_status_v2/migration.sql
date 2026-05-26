-- Support Helpdesk statuses v2
-- Safely replace SupportTicketStatus enum values without data loss.
-- Maps legacy values:
--   IN_REVIEW -> IN_PROGRESS
--   WAITING_FOR_USER -> WAITING_CLIENT

-- 1) Create new enum with desired final statuses.
CREATE TYPE "SupportTicketStatus_new" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'RESOLVED',
  'CLOSED',
  'ESCALATED'
);

-- 2) Drop default before type swap (old enum default blocks alter).
ALTER TABLE "support_tickets" ALTER COLUMN "status" DROP DEFAULT;

-- 3) Alter column type using explicit mapping.
ALTER TABLE "support_tickets"
  ALTER COLUMN "status" TYPE "SupportTicketStatus_new"
  USING (
    CASE "status"::text
      WHEN 'IN_REVIEW' THEN 'IN_PROGRESS'
      WHEN 'WAITING_FOR_USER' THEN 'WAITING_CLIENT'
      ELSE "status"::text
    END
  )::"SupportTicketStatus_new";

-- 4) Restore default.
ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- 5) Drop old enum and rename the new one.
DROP TYPE "SupportTicketStatus";
ALTER TYPE "SupportTicketStatus_new" RENAME TO "SupportTicketStatus";

