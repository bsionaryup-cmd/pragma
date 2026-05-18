-- iCal sync: UID dedupe + última sincronización por propiedad
ALTER TABLE "reservations" ADD COLUMN "icalUid" TEXT;

ALTER TABLE "properties" ADD COLUMN "lastIcalSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "reservations_propertyId_icalUid_key"
  ON "reservations"("propertyId", "icalUid");
