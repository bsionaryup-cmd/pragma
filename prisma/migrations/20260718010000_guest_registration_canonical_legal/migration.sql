-- Additive canonical guest fields + legal acceptance evidence (Guest Registration).
-- Non-destructive: existing rows remain valid with NULL profile/consent until new registrations.

ALTER TABLE "reservation_guests"
  ADD COLUMN "sex" TEXT,
  ADD COLUMN "travelMotive" TEXT,
  ADD COLUMN "occupation" TEXT,
  ADD COLUMN "residenceCountry" TEXT,
  ADD COLUMN "residenceAdminArea" TEXT,
  ADD COLUMN "residenceCity" TEXT,
  ADD COLUMN "originCountry" TEXT,
  ADD COLUMN "originAdminArea" TEXT,
  ADD COLUMN "originCity" TEXT,
  ADD COLUMN "destinationCountry" TEXT,
  ADD COLUMN "destinationAdminArea" TEXT,
  ADD COLUMN "destinationCity" TEXT;

CREATE TABLE "guest_registration_legal_acceptances" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT,
  "propertyId" TEXT,
  "acceptedByGuestId" TEXT NOT NULL,
  "titularFullName" TEXT NOT NULL,
  "titularDocumentType" TEXT NOT NULL,
  "titularDocumentNumber" TEXT NOT NULL,
  "lodgingContractVersion" TEXT NOT NULL,
  "lodgingContractAcceptedAt" TIMESTAMP(3) NOT NULL,
  "habeasDataPolicyVersion" TEXT NOT NULL,
  "habeasDataAcceptedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'es-CO',
  "evidenceJson" JSONB,

  CONSTRAINT "guest_registration_legal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guest_registration_legal_acceptances_reservationId_key"
  ON "guest_registration_legal_acceptances"("reservationId");

CREATE INDEX "guest_registration_legal_acceptances_organizationId_idx"
  ON "guest_registration_legal_acceptances"("organizationId");

CREATE INDEX "guest_registration_legal_acceptances_acceptedAt_idx"
  ON "guest_registration_legal_acceptances"("acceptedAt");

ALTER TABLE "guest_registration_legal_acceptances"
  ADD CONSTRAINT "guest_registration_legal_acceptances_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
