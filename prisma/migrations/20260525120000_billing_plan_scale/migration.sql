-- Add SCALE commercial plan (additive; existing STARTER/PRO unchanged)
ALTER TYPE "BillingPlanCode" ADD VALUE IF NOT EXISTS 'SCALE';
