/**
 * Pure runtime state machine — no I/O.
 */
import type {
  ConciergeRuntimeStatus,
  ConciergeRuntimeTransition,
} from "@/modules/ai-concierge/runtime/types";

const ALLOWED: Record<ConciergeRuntimeStatus, ConciergeRuntimeStatus[]> = {
  OFF: ["STARTING"],
  STARTING: ["RUNNING", "ERROR", "STOPPING", "OFF"],
  RUNNING: ["RECOVERING", "ERROR", "STOPPING"],
  RECOVERING: ["RUNNING", "ERROR", "STOPPING"],
  ERROR: ["RECOVERING", "STARTING", "STOPPING", "OFF"],
  STOPPING: ["OFF", "ERROR"],
};

export function canTransitionRuntime(
  from: ConciergeRuntimeStatus,
  to: ConciergeRuntimeStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionRuntime(input: {
  from: ConciergeRuntimeStatus;
  to: ConciergeRuntimeStatus;
  reason: string;
  at?: string;
}): ConciergeRuntimeTransition | null {
  if (!canTransitionRuntime(input.from, input.to)) return null;
  return {
    from: input.from,
    to: input.to,
    reason: input.reason,
    at: input.at ?? new Date().toISOString(),
  };
}

export function isRuntimeProcessing(status: ConciergeRuntimeStatus): boolean {
  return status === "RUNNING" || status === "RECOVERING" || status === "STARTING";
}

export function parseRuntimeStatus(value: unknown): ConciergeRuntimeStatus {
  const raw = String(value ?? "OFF").toUpperCase();
  if (
    raw === "OFF" ||
    raw === "STARTING" ||
    raw === "RUNNING" ||
    raw === "RECOVERING" ||
    raw === "ERROR" ||
    raw === "STOPPING"
  ) {
    return raw;
  }
  return "OFF";
}
