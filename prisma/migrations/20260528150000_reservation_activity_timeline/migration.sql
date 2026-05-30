-- Read-only reservation timeline from Airbnb emails (no reservation mutations)

CREATE TYPE "ReservationActivityType" AS ENUM (
  'AIRBNB_MESSAGE',
  'MODIFICATION_REQUEST',
  'MODIFICATION_APPROVED'
);

CREATE TABLE "reservation_activity" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "propertyId" TEXT,
  "activityType" "ReservationActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'airbnb_email',
  "sourceEmailId" TEXT,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_activity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservation_activity_sourceEmailId_key" ON "reservation_activity"("sourceEmailId");
CREATE INDEX "reservation_activity_reservationId_createdAt_idx" ON "reservation_activity"("reservationId", "createdAt" DESC);
CREATE INDEX "reservation_activity_propertyId_idx" ON "reservation_activity"("propertyId");
CREATE INDEX "reservation_activity_activityType_createdAt_idx" ON "reservation_activity"("activityType", "createdAt" DESC);

ALTER TABLE "reservation_activity" ADD CONSTRAINT "reservation_activity_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_activity" ADD CONSTRAINT "reservation_activity_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
