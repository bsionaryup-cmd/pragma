export type HealthStatus = "PASS" | "WARN" | "FAIL";

export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("WARN")) return "WARN";
  return "PASS";
}

export function classifyOutboxHealth(input: {
  failed: number;
  pending: number;
  oldestPendingAgeMinutes: number | null;
  lastDoneAt: Date | null;
  hasRetailStores: boolean;
}): HealthStatus {
  if (input.failed > 0) return "FAIL";
  if (
    input.oldestPendingAgeMinutes != null &&
    input.oldestPendingAgeMinutes > 60
  ) {
    return "WARN";
  }
  if (
    input.hasRetailStores &&
    input.pending === 0 &&
    input.lastDoneAt &&
    Date.now() - input.lastDoneAt.getTime() > 48 * 60 * 60 * 1000
  ) {
    return "WARN";
  }
  return "PASS";
}

export function classifyDbHealth(ok: boolean): HealthStatus {
  return ok ? "PASS" : "FAIL";
}

export function classifyEnvFlag(present: boolean, required: boolean): HealthStatus {
  if (required && !present) return "FAIL";
  if (!present) return "WARN";
  return "PASS";
}
