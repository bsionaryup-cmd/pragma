/**
 * Unified integration health — shared types (no server-only imports).
 * Safe to import from client components and pure unit tests.
 */

export type IntegrationHealthStatus =
  | "CONNECTED"
  | "DEGRADED"
  | "DISCONNECTED"
  | "VERIFYING"
  | "NEEDS_ATTENTION";

export type IntegrationHealthProvider =
  | "PRICELABS"
  | "TTLOCK"
  | "AIRBNB_ICAL"
  | "SIRE"
  | "TRAA";

export const INTEGRATION_HEALTH_PROVIDERS: readonly IntegrationHealthProvider[] = [
  "PRICELABS",
  "TTLOCK",
  "AIRBNB_ICAL",
  "SIRE",
  "TRAA",
] as const;

export type IntegrationHealthReport = {
  id: string;
  provider: IntegrationHealthProvider;
  status: IntegrationHealthStatus;
  /** Human-readable facts that justify `status` (Spanish, UI-ready). */
  evidence: string[];
  lastSuccessAt?: string | null;
  lastError?: string | null;
  /** True when an existing reconnect/test/sync action can plausibly fix it. */
  canRecover: boolean;
};

export type IntegrationHealthScope = {
  organizationId: string | null;
  userId: string;
};

export type IntegrationRecoveryResult = {
  provider: IntegrationHealthProvider;
  ok: boolean;
  /** True when nothing was executed (already healthy, not recoverable, cooldown, in flight). */
  skipped: boolean;
  message: string;
  /** Existing actions that were invoked, in order. */
  actions: string[];
};
