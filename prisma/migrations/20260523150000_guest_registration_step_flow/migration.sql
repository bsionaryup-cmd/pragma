CREATE TYPE "ReservationGuestStatus" AS ENUM (
  'PENDING_REGISTRATION',
  'REGISTERED',
  'VERIFIED',
  'CHECKED_IN',
  'CHECKED_OUT'
);

ALTER TABLE "reservation_guests"
  ADD COLUMN "isReservationOwner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status" "ReservationGuestStatus" NOT NULL DEFAULT 'REGISTERED',
  ADD COLUMN "nationality" TEXT,
  ADD COLUMN "dateOfBirth" DATE;

UPDATE "reservation_guests"
SET "isReservationOwner" = "isPrimary"
WHERE "isPrimary" = true;

CREATE INDEX "reservation_guests_reservationId_status_idx"
  ON "reservation_guests"("reservationId", "status");
