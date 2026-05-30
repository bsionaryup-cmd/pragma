-- Observability feed for Airbnb modification emails (no reservation mutations)

CREATE TYPE "ReservationEventType" AS ENUM ('MODIFICATION_REQUEST', 'MODIFICATION_APPROVED');

CREATE TABLE "reservation_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "reservationId" TEXT,
  "propertyId" TEXT,
  "eventType" "ReservationEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metadataJson" JSONB,
  "source" TEXT NOT NULL DEFAULT 'airbnb_email',
  "sourceEmailId" TEXT,
  "rawSubject" TEXT,
  "classificationConfidence" DECIMAL(5,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reservation_events_organizationId_createdAt_idx" ON "reservation_events"("organizationId", "createdAt" DESC);
CREATE INDEX "reservation_events_reservationId_idx" ON "reservation_events"("reservationId");
CREATE INDEX "reservation_events_propertyId_idx" ON "reservation_events"("propertyId");
CREATE INDEX "reservation_events_eventType_createdAt_idx" ON "reservation_events"("eventType", "createdAt" DESC);
CREATE INDEX "reservation_events_sourceEmailId_eventType_idx" ON "reservation_events"("sourceEmailId", "eventType");

ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
