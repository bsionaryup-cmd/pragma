-- Additive TRA (Res. 409/2022) guest fields — nullable, non-destructive
ALTER TABLE "reservation_guests" ADD COLUMN IF NOT EXISTS "cityOfResidence" TEXT;
ALTER TABLE "reservation_guests" ADD COLUMN IF NOT EXISTS "cityOfOrigin" TEXT;
ALTER TABLE "reservation_guests" ADD COLUMN IF NOT EXISTS "travelPurpose" TEXT;
