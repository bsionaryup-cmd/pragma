-- Pending Airbnb activity (no reservation match yet) + per-user seen tracking

ALTER TYPE "ReservationActivityType" ADD VALUE 'UNMATCHED_AIRBNB';

CREATE TABLE "reservation_activity_pending" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "propertyId" TEXT,
  "activityType" "ReservationActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'airbnb_email',
  "sourceEmailId" TEXT NOT NULL,
  "rawSubject" TEXT,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "metadataJson" JSONB,
  "classificationConfidence" DECIMAL(5,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_activity_pending_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservation_activity_pending_sourceEmailId_key" ON "reservation_activity_pending"("sourceEmailId");
CREATE INDEX "reservation_activity_pending_organizationId_createdAt_idx" ON "reservation_activity_pending"("organizationId", "createdAt" DESC);
CREATE INDEX "reservation_activity_pending_propertyId_createdAt_idx" ON "reservation_activity_pending"("propertyId", "createdAt" DESC);

ALTER TABLE "reservation_activity_pending" ADD CONSTRAINT "reservation_activity_pending_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reservation_activity_pending" ADD CONSTRAINT "reservation_activity_pending_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "reservation_activity_seen" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_activity_seen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservation_activity_seen_userId_reservationId_key" ON "reservation_activity_seen"("userId", "reservationId");
CREATE INDEX "reservation_activity_seen_reservationId_idx" ON "reservation_activity_seen"("reservationId");

ALTER TABLE "reservation_activity_seen" ADD CONSTRAINT "reservation_activity_seen_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_activity_seen" ADD CONSTRAINT "reservation_activity_seen_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
