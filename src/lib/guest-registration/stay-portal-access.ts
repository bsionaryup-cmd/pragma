import { createHash } from "node:crypto";

export type StayPortalState =
  | "active"
  | "ended"
  | "unavailable"
  | "not_found"
  | "incomplete";

export type StayPortalView = {
  state: StayPortalState;
  token: string | null;
  propertyLabel: string | null;
  unitNumber: string | null;
  guestName: string | null;
  reservationCode: string | null;
  checkInLabel: string | null;
  checkOutLabel: string | null;
  statusLabel: string | null;
  accessCode: string | null;
  accessValidFrom: string | null;
  accessValidTo: string | null;
  addressLine: string | null;
  mapsUrl: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  accessInstructions: string | null;
  houseRules: string | null;
  contactName: string | null;
  contactWhatsapp: string | null;
  contactPhone: string | null;
  whatsappUrl: string | null;
  telUrl: string | null;
};

export function normalizeStayReservationCode(value: string): string {
  return value.trim().toUpperCase();
}

export function buildStayPortalAccessRateLimitKey(value: string): string {
  return createHash("sha256")
    .update(value.trim() || "unknown")
    .digest("hex");
}

const ACCESS_WINDOW_MS = 10 * 60_000;
const ACCESS_MAX_ATTEMPTS = 5;
const ACCESS_MAX_BUCKETS = 10_000;
const accessBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkStayPortalAccessRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = accessBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && accessBuckets.size >= ACCESS_MAX_BUCKETS) {
      const oldestKey = accessBuckets.keys().next().value;
      if (oldestKey) accessBuckets.delete(oldestKey);
    }
    accessBuckets.set(key, { count: 1, resetAt: now + ACCESS_WINDOW_MS });
    return true;
  }

  if (bucket.count >= ACCESS_MAX_ATTEMPTS) return false;
  bucket.count += 1;
  return true;
}

export function checkStayPortalAccessRateLimits(
  ipKey: string,
  codeKey: string,
): boolean {
  if (!checkStayPortalAccessRateLimit(ipKey)) return false;
  return checkStayPortalAccessRateLimit(codeKey);
}
