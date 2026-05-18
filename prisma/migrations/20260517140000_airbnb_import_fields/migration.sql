-- Airbnb import: listing URL, room id, iCal sync
ALTER TABLE "properties"
  ADD COLUMN "airbnbListingUrl" TEXT,
  ADD COLUMN "airbnbRoomId" TEXT,
  ADD COLUMN "icalUrl" TEXT;

CREATE INDEX "properties_airbnbRoomId_idx" ON "properties"("airbnbRoomId");
