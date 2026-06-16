import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import type {
  ExtractedReservationSignals,
  ReservationMatchResult,
} from "@/modules/airbnb-email/types";

const ICAL_PLACEHOLDER_GUEST_NAMES = new Set([
  "huésped airbnb",
  "airbnb guest",
  "airbnb",
  "reserved",
  "reservado",
  "not available",
  "no disponible",
]);

const ENRICHABLE_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
]);

/** Only confirmation emails may set or replace guestName from parsed signals. */
const GUEST_NAME_SOURCE_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
]);

export type SafeEnrichmentMode = "reservation" | "financial";

export function isPlaceholderGuestName(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  if (ICAL_PLACEHOLDER_GUEST_NAMES.has(normalized)) return true;
  if (/^airbnb\b/i.test(trimmed) && trimmed.length <= 40) return true;
  return false;
}

/** Normaliza SUMMARY de iCal Airbnb a nombre de huésped o placeholder canónico. */
export function normalizeIcalGuestNameFromSummary(
  summary: string,
  blocked: boolean,
): string {
  if (blocked) return "Bloqueo Airbnb";
  const cleaned = summary
    .replace(/^reserved\s*[-–:]?\s*/i, "")
    .replace(/^reservado\s*[-–:]?\s*/i, "")
    .trim();
  const candidate = cleaned || "Huésped Airbnb";
  return isPlaceholderGuestName(candidate) ? "Huésped Airbnb" : candidate;
}

/** Campos enriquecidos para evento de correo (persistencia + display). */
export function mergeEnrichedFieldsForEmailEvent(input: {
  reservationEnrichedFields: Record<string, string | number>;
  metadataFields: Record<string, string | number>;
  signals: ExtractedReservationSignals;
  eventKind?: AirbnbEmailEventKind;
}): Record<string, string | number> {
  const merged = {
    ...input.reservationEnrichedFields,
    ...input.metadataFields,
  };
  const existing =
    typeof merged.guestName === "string" ? merged.guestName.trim() : "";
  if (existing && !isPlaceholderGuestName(existing)) {
    return merged;
  }

  const canSetGuestNameFromSignals =
    !input.eventKind || GUEST_NAME_SOURCE_EVENT_KINDS.has(input.eventKind);
  if (!canSetGuestNameFromSignals) {
    return merged;
  }

  const fromSignals = input.signals.guestName?.trim();
  if (fromSignals && isPlausibleGuestName(fromSignals)) {
    merged.guestName = fromSignals;
  }
  return merged;
}

export function isZeroReservationAmount(value: unknown): boolean {
  if (value == null) return true;
  const n = typeof value === "object" && "toNumber" in (value as object)
    ? Number((value as { toNumber: () => number }).toNumber())
    : Number(value);
  return !Number.isFinite(n) || n === 0;
}

export function splitGuestName(fullName: string): {
  guestName: string;
  guestFirstName: string;
  guestLastName: string | null;
} {
  const guestName = fullName.trim().replace(/\s+/g, " ");
  const parts = guestName.split(/\s+/);
  const guestFirstName = parts[0] ?? guestName;
  const guestLastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { guestName, guestFirstName, guestLastName };
}

/** Prefer net payout; fall back to host payout then gross booking amount. */
export function pickReservationAmount(
  signals: ExtractedReservationSignals,
): number | null {
  const candidates = [
    signals.netPayout,
    signals.hostPayoutAmount,
    signals.grossAmount,
  ];
  for (const value of candidates) {
    if (value != null && value > 0) return value;
  }
  return null;
}

export async function applySafeReservationEnrichment(input: {
  match: ReservationMatchResult;
  signals: ExtractedReservationSignals;
  eventKind?: AirbnbEmailEventKind;
  mode?: SafeEnrichmentMode;
}): Promise<Record<string, string | number>> {
  const mode = input.mode ?? "reservation";

  if (!input.match.allowReservationEnrichment || !input.match.reservationId) {
    airbnbEmailLog.info("enrichment_skipped", {
      reservationId: input.match.reservationId ?? undefined,
      reason: "policy_blocked",
      mode,
    });
    return {};
  }

  if (
    mode === "reservation" &&
    input.eventKind &&
    !ENRICHABLE_EVENT_KINDS.has(input.eventKind)
  ) {
    airbnbEmailLog.info("enrichment_skipped", {
      reservationId: input.match.reservationId,
      reason: "event_kind",
      eventKind: input.eventKind,
    });
    return {};
  }

  const reservation = await db.reservation.findUnique({
    where: { id: input.match.reservationId },
    select: {
      reservationCode: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      adults: true,
      children: true,
      infants: true,
      totalAmount: true,
      currency: true,
      guestRegistrationCompletedAt: true,
    },
  });

  if (!reservation) {
    airbnbEmailLog.warn("enrichment_skipped", {
      reservationId: input.match.reservationId,
      reason: "reservation_not_found",
    });
    return {};
  }

  const guestFieldsLocked = Boolean(reservation.guestRegistrationCompletedAt);
  const updates: Prisma.ReservationUpdateInput = {};
  const applied: Record<string, string | number> = {};
  const skipped: string[] = [];

  if (mode === "financial") {
    const amount = pickReservationAmount(input.signals);
    if (amount != null && isZeroReservationAmount(reservation.totalAmount)) {
      updates.totalAmount = amount;
      applied.totalAmount = amount;
      if (input.signals.currency?.trim() && !reservation.currency?.trim()) {
        updates.currency = input.signals.currency.trim();
        applied.currency = input.signals.currency.trim();
      }
    } else {
      skipped.push("totalAmount");
    }
  } else {
    const code = input.signals.confirmationCode?.trim();
    if (code && !reservation.reservationCode?.trim()) {
      updates.reservationCode = code;
      applied.reservationCode = code;
    } else if (code) {
      skipped.push("reservationCode");
    }

    if (!guestFieldsLocked) {
      const canApplyGuestName =
        !input.eventKind || GUEST_NAME_SOURCE_EVENT_KINDS.has(input.eventKind);
      const guestNameRaw = input.signals.guestName?.trim();
      if (!canApplyGuestName && guestNameRaw) {
        skipped.push("guestName");
      } else if (guestNameRaw && isPlaceholderGuestName(reservation.guestName)) {
        const split = splitGuestName(guestNameRaw);
        updates.guestName = split.guestName;
        updates.guestFirstName = split.guestFirstName;
        updates.guestLastName = split.guestLastName;
        applied.guestName = split.guestName;
      } else if (guestNameRaw) {
        skipped.push("guestName");
      }

      const email = input.signals.guestEmail?.trim();
      if (email && !reservation.guestEmail?.trim()) {
        updates.guestEmail = email;
        applied.guestEmail = email;
      } else if (email) {
        skipped.push("guestEmail");
      }

      const phone = input.signals.guestPhone?.trim();
      if (phone && !reservation.guestPhone?.trim()) {
        updates.guestPhone = phone;
        applied.guestPhone = phone;
      } else if (phone) {
        skipped.push("guestPhone");
      }

      const defaultOccupancy =
        reservation.adults === 1 &&
        reservation.children === 0 &&
        reservation.infants === 0;

      if (defaultOccupancy) {
        const adultCount = input.signals.adultCount ?? null;
        const childCount = input.signals.childCount ?? null;
        const infantCount = input.signals.infantCount ?? null;

        if (adultCount != null && adultCount > 0) {
          updates.adults = adultCount;
          applied.adults = adultCount;
          if (childCount != null) {
            updates.children = childCount;
            applied.children = childCount;
          }
          if (infantCount != null) {
            updates.infants = infantCount;
            applied.infants = infantCount;
          }
        } else {
          const guestTotal =
            input.signals.guestCountTotal ??
            input.signals.guestCount ??
            null;
          if (guestTotal != null && guestTotal > 0 && guestTotal !== reservation.adults) {
            updates.adults = guestTotal;
            applied.adults = guestTotal;
          } else if (guestTotal != null) {
            skipped.push("adults");
          }
        }
      } else {
        skipped.push("adults");
      }
    } else {
      skipped.push("guestFieldsLocked");
    }

    const amount = pickReservationAmount(input.signals);
    if (amount != null && isZeroReservationAmount(reservation.totalAmount)) {
      updates.totalAmount = amount;
      applied.totalAmount = amount;
      if (input.signals.currency?.trim()) {
        updates.currency = input.signals.currency.trim();
        applied.currency = input.signals.currency.trim();
      }
    } else if (amount != null) {
      skipped.push("totalAmount");
    }
  }

  if (Object.keys(updates).length === 0) {
    airbnbEmailLog.info("enrichment_noop", {
      reservationId: input.match.reservationId,
      mode,
      skipped: skipped.join(",") || undefined,
    });
    return {};
  }

  await db.reservation.update({
    where: { id: input.match.reservationId },
    data: updates,
  });

  airbnbEmailLog.info("enrichment_applied", {
    reservationId: input.match.reservationId,
    mode,
    fields: Object.keys(applied).join(","),
    matchMethod: input.match.method,
    matchConfidence: input.match.confidence,
    skipped: skipped.length > 0 ? skipped.join(",") : undefined,
  });

  return applied;
}
