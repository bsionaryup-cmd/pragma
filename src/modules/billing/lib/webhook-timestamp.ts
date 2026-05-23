import type { WompiWebhookEvent } from "@/modules/billing/domain/types";

/** Reject webhooks older than 5 minutes (replay protection). */
export const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

/** Reject webhooks with clock skew more than 1 minute in the future. */
export const WEBHOOK_MAX_FUTURE_SKEW_MS = 60 * 1000;

function normalizeEventTimestampMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

export function validateWompiWebhookTimestamp(
  event: WompiWebhookEvent,
  options?: { strict?: boolean },
): { valid: boolean; reason?: string } {
  const ts = event.timestamp;
  if (ts == null) {
    if (options?.strict) {
      return { valid: false, reason: "timestamp_missing" };
    }
    return { valid: true };
  }

  if (typeof ts !== "number" || !Number.isFinite(ts)) {
    return { valid: false, reason: "timestamp_invalid" };
  }

  const eventMs = normalizeEventTimestampMs(ts);
  const now = Date.now();
  const age = now - eventMs;

  if (age > WEBHOOK_MAX_AGE_MS) {
    return { valid: false, reason: "timestamp_expired" };
  }

  if (age < -WEBHOOK_MAX_FUTURE_SKEW_MS) {
    return { valid: false, reason: "timestamp_future" };
  }

  return { valid: true };
}
