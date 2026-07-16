-- Property operational contacts SSOT (email + whatsapp + role)

ALTER TABLE "properties"
ADD COLUMN "operationalContacts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "guestRegistrationContactKey" TEXT;

