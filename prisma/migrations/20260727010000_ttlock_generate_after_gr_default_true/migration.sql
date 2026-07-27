-- Restore product SSOT: Guest Registration completion auto-generates TTLock codes.
-- Prior default false silently skipped generation for orgs that never toggled the UI.

ALTER TABLE "ttlock_automation_settings"
  ALTER COLUMN "generateAfterGuestRegistration" SET DEFAULT true;

UPDATE "ttlock_automation_settings"
SET "generateAfterGuestRegistration" = true
WHERE "generateAfterGuestRegistration" = false;
