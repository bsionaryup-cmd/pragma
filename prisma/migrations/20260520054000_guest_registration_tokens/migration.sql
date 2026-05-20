CREATE TYPE "GuestRegistrationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED');

CREATE TABLE "guest_registration_tokens" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "GuestRegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 10,
  "createdBySystem" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guest_registration_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guest_registration_tokens_token_key"
  ON "guest_registration_tokens"("token");

CREATE INDEX "guest_registration_tokens_reservationId_status_idx"
  ON "guest_registration_tokens"("reservationId", "status");

CREATE INDEX "guest_registration_tokens_token_status_idx"
  ON "guest_registration_tokens"("token", "status");

ALTER TABLE "guest_registration_tokens"
  ADD CONSTRAINT "guest_registration_tokens_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "guest_registration_tokens" (
  "id",
  "reservationId",
  "token",
  "status",
  "expiresAt",
  "usedAt",
  "createdBySystem",
  "createdAt",
  "updatedAt"
)
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  "id",
  "guestRegistrationToken",
  CASE
    WHEN "guestRegistrationCompletedAt" IS NOT NULL THEN 'COMPLETED'::"GuestRegistrationStatus"
    ELSE 'ACTIVE'::"GuestRegistrationStatus"
  END,
  "checkOut" + INTERVAL '1 day',
  "guestRegistrationCompletedAt",
  true,
  COALESCE("createdAt", CURRENT_TIMESTAMP),
  COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM "reservations"
WHERE "guestRegistrationToken" IS NOT NULL
ON CONFLICT ("token") DO NOTHING;
