import {
  BookingPlatform,
  GuestRegistrationStatus,
  ReservationStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  buildGuestRegistrationUrl,
  ensureGuestRegistrationForReservation,
} from "@/services/guests/guest-registration.service";

const ACCESS_WINDOW_MS = 10 * 60_000;
const ACCESS_MAX_ATTEMPTS = 5;
const ACCESS_MAX_BUCKETS = 10_000;
const accessBuckets = new Map<string, { count: number; resetAt: number }>();

const ELIGIBLE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
];

export type AirbnbUniversalAccessResult =
  | { ok: true; url: string; state: "active" | "completed" }
  | { ok: false; reason: "invalid" | "rate_limited" };

export function normalizeAirbnbReservationCode(value: string): string {
  return value.trim().toUpperCase();
}

export function buildAirbnbUniversalAccessRateLimitKey(
  value: string,
): string {
  return createHash("sha256")
    .update(value.trim() || "unknown")
    .digest("hex");
}

/**
 * Process-local defense in depth. The action consumes both an IP bucket and a
 * code bucket, so rotating IPs does not bypass throttling on the same instance.
 * Production edge/WAF throttling is still required for a globally shared cap.
 */
export function checkAirbnbUniversalAccessRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = accessBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Keep attacker-controlled cardinality bounded. Map preserves insertion
    // order, so the oldest process-local bucket is evicted first.
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

export function checkAirbnbUniversalAccessRateLimits(
  ipKey: string,
  codeKey: string,
): boolean {
  // A blocked IP must not create or evict code buckets.
  if (!checkAirbnbUniversalAccessRateLimit(ipKey)) return false;
  return checkAirbnbUniversalAccessRateLimit(codeKey);
}

export async function resolveAirbnbUniversalGuestRegistration(input: {
  reservationCode: string;
}): Promise<AirbnbUniversalAccessResult> {
  const reservationCode = normalizeAirbnbReservationCode(
    input.reservationCode,
  );

  // No tenant identifier is present in the universal URL. Fail closed if the
  // code matches more than one Airbnb reservation globally.
  const matches = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      reservationCode: {
        equals: reservationCode,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      status: true,
      guestRegistrationCompletedAt: true,
    },
    take: 2,
  });

  if (matches.length !== 1) return { ok: false, reason: "invalid" };

  const reservation = matches[0];
  if (reservation.guestRegistrationCompletedAt) {
    const completed = await db.guestRegistrationToken.findFirst({
      where: {
        reservationId: reservation.id,
        status: GuestRegistrationStatus.COMPLETED,
      },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });
    if (!completed) return { ok: false, reason: "invalid" };
    return {
      ok: true,
      url: buildGuestRegistrationUrl(completed.token),
      state: "completed",
    };
  }

  if (!ELIGIBLE_STATUSES.includes(reservation.status)) {
    return { ok: false, reason: "invalid" };
  }

  const url = await ensureGuestRegistrationForReservation(reservation.id);
  if (!url) return { ok: false, reason: "invalid" };

  return { ok: true, url, state: "active" };
}

export const AIRBNB_UNIVERSAL_ACCESS_RATE_LIMIT = {
  maxAttempts: ACCESS_MAX_ATTEMPTS,
  windowMs: ACCESS_WINDOW_MS,
} as const;
