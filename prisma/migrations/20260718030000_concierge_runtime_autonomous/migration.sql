-- Additive Concierge Runtime Autónomo fields (non-destructive).
CREATE TYPE "ConciergeRuntimeStatus" AS ENUM (
  'OFF',
  'STARTING',
  'RUNNING',
  'RECOVERING',
  'ERROR',
  'STOPPING'
);

ALTER TABLE "concierge_configurations"
  ADD COLUMN "runtimeDesiredOn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "runtimeStatus" "ConciergeRuntimeStatus" NOT NULL DEFAULT 'OFF',
  ADD COLUMN "runtimeLastTransitionAt" TIMESTAMP(3),
  ADD COLUMN "runtimeLastError" TEXT,
  ADD COLUMN "runtimeWatchdogAt" TIMESTAMP(3),
  ADD COLUMN "runtimeMeta" JSONB;
