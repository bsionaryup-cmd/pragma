-- Guest Stay Portal tokens (post Guest Registration). Independent of GR tokens.

CREATE TYPE "StayPortalTokenStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TABLE "stay_portal_tokens" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "StayPortalTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stay_portal_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stay_portal_tokens_token_key" ON "stay_portal_tokens"("token");
CREATE INDEX "stay_portal_tokens_reservationId_status_idx" ON "stay_portal_tokens"("reservationId", "status");
CREATE INDEX "stay_portal_tokens_token_status_idx" ON "stay_portal_tokens"("token", "status");

ALTER TABLE "stay_portal_tokens"
  ADD CONSTRAINT "stay_portal_tokens_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
