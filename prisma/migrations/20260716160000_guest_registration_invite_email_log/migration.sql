-- Guest registration invite (welcome) email delivery log + idempotency

ALTER TABLE "reservations"
ADD COLUMN "guestRegistrationInviteSentAt" TIMESTAMP(3),
ADD COLUMN "guestRegistrationInviteError" TEXT,
ADD COLUMN "guestRegistrationInviteLog" JSONB NOT NULL DEFAULT '[]';
