-- CreateEnum
CREATE TYPE "TTLockEnvironment" AS ENUM ('PRODUCTION', 'SANDBOX');

-- AlterEnum
ALTER TYPE "TTLockIntegrationStatus" ADD VALUE 'CONNECTING';
ALTER TYPE "TTLockIntegrationStatus" ADD VALUE 'INVALID_CREDENTIALS';

-- AlterTable
ALTER TABLE "ttlock_integrations" ADD COLUMN "environment" "TTLockEnvironment" NOT NULL DEFAULT 'PRODUCTION';
ALTER TABLE "ttlock_integrations" ADD COLUMN "redirectUri" TEXT;
ALTER TABLE "ttlock_integrations" ADD COLUMN "lastError" TEXT;
