-- Guest registration admin notification (property emails + reservation idempotency)

ALTER TABLE "properties"
ADD COLUMN "notificationEmails" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "reservations"
ADD COLUMN "guestRegistrationAdminNotifiedAt" TIMESTAMP(3),
ADD COLUMN "guestRegistrationAdminNotificationError" TEXT;
