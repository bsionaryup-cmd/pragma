-- Guest registration admin notification delivery log (traceability)

ALTER TABLE "reservations"
ADD COLUMN "guestRegistrationAdminNotificationLog" JSONB NOT NULL DEFAULT '[]';
