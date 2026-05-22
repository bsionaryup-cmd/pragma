-- Platform Super Admin Owner layer

CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPER_ADMIN_OWNER');
CREATE TYPE "PlatformImpersonationStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

ALTER TABLE "organizations" ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "organizations" ADD COLUMN "suspendedAt" TIMESTAMP(3);

ALTER TABLE "users" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE';
CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");

UPDATE "users"
SET "platformRole" = 'SUPER_ADMIN_OWNER'
WHERE LOWER("email") = LOWER('bsionaryup@gmail.com');

CREATE TABLE "platform_impersonation_sessions" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "targetOrganizationId" TEXT NOT NULL,
    "status" "PlatformImpersonationStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "endReason" TEXT,

    CONSTRAINT "platform_impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetTenantId" TEXT,
    "targetUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "platform_impersonation_sessions" ADD CONSTRAINT "platform_impersonation_sessions_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_impersonation_sessions" ADD CONSTRAINT "platform_impersonation_sessions_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "platform_impersonation_sessions_platformUserId_status_idx" ON "platform_impersonation_sessions"("platformUserId", "status");
CREATE INDEX "platform_impersonation_sessions_targetOrganizationId_status_idx" ON "platform_impersonation_sessions"("targetOrganizationId", "status");
CREATE INDEX "platform_impersonation_sessions_expiresAt_idx" ON "platform_impersonation_sessions"("expiresAt");

CREATE INDEX "platform_audit_logs_platformUserId_createdAt_idx" ON "platform_audit_logs"("platformUserId", "createdAt" DESC);
CREATE INDEX "platform_audit_logs_targetTenantId_createdAt_idx" ON "platform_audit_logs"("targetTenantId", "createdAt" DESC);
CREATE INDEX "platform_audit_logs_action_createdAt_idx" ON "platform_audit_logs"("action", "createdAt" DESC);
