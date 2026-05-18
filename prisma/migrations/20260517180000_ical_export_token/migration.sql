ALTER TABLE "properties" ADD COLUMN "icalExportToken" TEXT;

CREATE UNIQUE INDEX "properties_icalExportToken_key" ON "properties"("icalExportToken");
