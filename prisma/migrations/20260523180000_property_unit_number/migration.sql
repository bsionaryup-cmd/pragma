-- Número visible de apartamento/unidad (801, 802, etc.)
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT;

CREATE INDEX IF NOT EXISTS "properties_unitNumber_idx" ON "properties"("unitNumber");
