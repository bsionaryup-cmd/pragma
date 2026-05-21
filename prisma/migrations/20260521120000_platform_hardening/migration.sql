-- UserRole: OPERATIONS -> RECEPTIONIST
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'RECEPTIONIST');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE
    WHEN "role"::text = 'OPERATIONS' THEN 'RECEPTIONIST'::"UserRole_new"
    WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole_new"
    ELSE 'RECEPTIONIST'::"UserRole_new"
  END
);
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'RECEPTIONIST';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Bogota';

CREATE TYPE "LoginActivityStatus" AS ENUM ('SUCCESS', 'FAILED');
CREATE TABLE "login_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "status" "LoginActivityStatus" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_activities_userId_createdAt_idx" ON "login_activities"("userId", "createdAt" DESC);
ALTER TABLE "login_activities" ADD CONSTRAINT "login_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID';
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "reservationCode" TEXT;

CREATE TYPE "ManualPaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'OTHER');
CREATE TABLE "manual_expenses" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "paymentMethod" "ManualPaymentMethod" NOT NULL,
    "expenseDate" DATE NOT NULL,
    "description" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "manual_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "manual_expenses_expenseDate_idx" ON "manual_expenses"("expenseDate");
CREATE INDEX "manual_expenses_createdById_idx" ON "manual_expenses"("createdById");
ALTER TABLE "manual_expenses" ADD CONSTRAINT "manual_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "other_incomes" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "incomeType" TEXT NOT NULL,
    "incomeDate" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "other_incomes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "other_incomes_incomeDate_idx" ON "other_incomes"("incomeDate");
CREATE INDEX "other_incomes_createdById_idx" ON "other_incomes"("createdById");
ALTER TABLE "other_incomes" ADD CONSTRAINT "other_incomes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ExternalIntegrationProvider" AS ENUM ('SIRE', 'TRAA');
CREATE TYPE "ExternalIntegrationStatus" AS ENUM ('NOT_CONNECTED', 'PENDING_SETUP', 'CONNECTED', 'ERROR');
CREATE TABLE "external_integrations" (
    "id" TEXT NOT NULL,
    "provider" "ExternalIntegrationProvider" NOT NULL,
    "apiKeyEncrypted" TEXT,
    "tokenEncrypted" TEXT,
    "clientId" TEXT,
    "clientSecretEncrypted" TEXT,
    "callbackUrl" TEXT,
    "status" "ExternalIntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "lastError" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_integrations_provider_key" ON "external_integrations"("provider");
ALTER TABLE "external_integrations" ADD CONSTRAINT "external_integrations_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "properties" SET "checkOutTime" = '13:00' WHERE "checkOutTime" IS NULL OR "checkOutTime" = '11:00';
