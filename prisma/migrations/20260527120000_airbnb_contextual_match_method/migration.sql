-- Add contextual listing match method (iCal-backed, email dates optional)
ALTER TYPE "AirbnbEmailMatchMethod" ADD VALUE IF NOT EXISTS 'LISTING_CONTEXTUAL_MATCH';
