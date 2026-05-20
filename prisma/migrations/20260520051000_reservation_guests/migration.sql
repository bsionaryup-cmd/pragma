ALTER TABLE "reservations"
  ADD COLUMN "guestRegistrationToken" TEXT,
  ADD COLUMN "guestRegistrationCompletedAt" TIMESTAMP(3);

CREATE TABLE "reservation_guests" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reservation_guests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservations_guestRegistrationToken_key"
  ON "reservations"("guestRegistrationToken");

CREATE UNIQUE INDEX "reservation_guests_reservationId_documentType_documentNumber_key"
  ON "reservation_guests"("reservationId", "documentType", "documentNumber");

CREATE INDEX "reservation_guests_reservationId_isPrimary_idx"
  ON "reservation_guests"("reservationId", "isPrimary");

ALTER TABLE "reservation_guests"
  ADD CONSTRAINT "reservation_guests_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
