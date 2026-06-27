import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind, AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { resolveAuthoritativeHostPayout } from "@/lib/finance/resolve-authoritative-host-payout";
import { db } from "@/lib/db";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import { isHostPayoutConsistentWithGuestTotal } from "@/modules/airbnb-email/parsing/reservation-financials-extract";
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

/** Monto contable del anfitrión: solo payout real (nunca bruto de huésped). */
export function pickAuthoritativeHostRevenueAmount(
  signals: ExtractedReservationSignals,
): number | null {
  for (const value of [signals.hostPayoutAmount, signals.netPayout]) {
    if (value != null && value > 0) {
      if (
        isHostPayoutConsistentWithGuestTotal({
          hostPayoutAmount: value,
          guestTotalPaid: signals.guestTotalPaid,
          grossAmount: signals.grossAmount,
        })
      ) {
        return value;
      }
    }
  }
  return null;
}

/** Prefer host payout; gross only as último recurso cuando no hay payout del anfitrión. */
export function pickReservationAmount(
  signals: ExtractedReservationSignals,
): number | null {
  const hostRevenue = pickAuthoritativeHostRevenueAmount(signals);
  if (hostRevenue != null) return hostRevenue;
  if (signals.grossAmount != null && signals.grossAmount > 0) {
    return signals.grossAmount;
  }
  return null;
}

export function isStoredGuestFacingAirbnbAmount(
  storedAmount: unknown,
  signals: ExtractedReservationSignals,
): boolean {
  const stored = readStoredAmount(storedAmount);
  if (stored == null) return false;
  const gross = signals.grossAmount ?? 0;
  const guestTotal = signals.guestTotalPaid ?? 0;
  return (
    (gross > 0 && Math.abs(stored - gross) < 1) ||
    (guestTotal > 0 && Math.abs(stored - guestTotal) < 1)
  );
}

const FINANCIAL_AMOUNT_CORRECTION_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
]);

const CONFIRM_LIKE_CORRECTION_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
]);

function readStoredAmount(value: unknown): number | null {
  if (value == null) return null;
  const n =
    typeof value === "object" && value !== null && "toNumber" in value
      ? Number((value as { toNumber: () => number }).toNumber())
      : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** UPDATED/EXTENDED/CONFIRMED pueden corregir montos parciales o bruto vs payout del anfitrión. */
export function shouldCorrectStoredReservationAmount(input: {
  eventKind?: AirbnbEmailEventKind;
  storedAmount: unknown;
  incomingAmount: number;
  signals: ExtractedReservationSignals;
}): boolean {
  if (!input.eventKind) return false;

  const hostPayout = input.signals.hostPayoutAmount ?? 0;
  const hasAuthoritativeHostPayout = hostPayout > 0;
  const hasAuthoritativeNet = (input.signals.netPayout ?? 0) > 0;
  if (!hasAuthoritativeHostPayout && !hasAuthoritativeNet) return false;

  const authoritativeAmount = hasAuthoritativeHostPayout
    ? hostPayout
    : input.incomingAmount;

  const stored = readStoredAmount(input.storedAmount);
  if (stored == null) return true;
  if (Math.abs(stored - authoritativeAmount) < 1) return false;

  if (FINANCIAL_AMOUNT_CORRECTION_KINDS.has(input.eventKind)) {
    return (
      authoritativeAmount > stored * 1.05 || stored < authoritativeAmount * 0.5
    );
  }

  if (CONFIRM_LIKE_CORRECTION_KINDS.has(input.eventKind)) {
    if (isStoredGuestFacingAirbnbAmount(stored, input.signals)) return true;
    if (
      hasAuthoritativeHostPayout &&
      hostPayout < stored * 0.98 &&
      isHostPayoutConsistentWithGuestTotal({
        hostPayoutAmount: hostPayout,
        guestTotalPaid: input.signals.guestTotalPaid,
        grossAmount: input.signals.grossAmount,
      })
    ) {
      return true;
    }
    return Math.abs(stored - authoritativeAmount) / authoritativeAmount > 0.02;
  }

  return false;
}

function resolveEnrichmentHostAmount(
  signals: ExtractedReservationSignals,
): number | null {
  const authoritative = resolveAuthoritativeHostPayout({
    confirmationCode: signals.confirmationCode,
    checkIn: signals.checkIn,
    checkOut: signals.checkOut,
    emailMatchBlob: signals.emailMatchBlob,
    payloadSignals: signals,
    enrichedFields: signals,
  }).hostPayoutAmount;
  if (authoritative != null && authoritative > 0) return authoritative;

  return (
    pickAuthoritativeHostRevenueAmount(signals) ?? pickReservationAmount(signals)
  );
}

function applyReservationAmountUpdate(input: {
  eventKind?: AirbnbEmailEventKind;
  reservationTotalAmount: unknown;
  signals: ExtractedReservationSignals;
  updates: Prisma.ReservationUpdateInput;
  applied: Record<string, string | number>;
  skipped: string[];
}) {
  const amount = resolveEnrichmentHostAmount(input.signals);
  if (amount == null) return;

  if (isZeroReservationAmount(input.reservationTotalAmount)) {
    input.updates.totalAmount = amount;
    input.applied.totalAmount = amount;
    if (input.signals.currency?.trim()) {
      input.updates.currency = input.signals.currency.trim();
      input.applied.currency = input.signals.currency.trim();
    }
    return;
  }

  if (
    shouldCorrectStoredReservationAmount({
      eventKind: input.eventKind,
      storedAmount: input.reservationTotalAmount,
      incomingAmount: amount,
      signals: input.signals,
    })
  ) {
    input.updates.totalAmount = amount;
    input.applied.totalAmount = amount;
    if (input.signals.currency?.trim()) {
      input.updates.currency = input.signals.currency.trim();
      input.applied.currency = input.signals.currency.trim();
    }
    return;
  }

  input.skipped.push("totalAmount");
}

export async function applySafeReservationEnrichment(input: {
  match: ReservationMatchResult;
  signals: ExtractedReservationSignals;
  eventKind?: AirbnbEmailEventKind;
  mode?: SafeEnrichmentMode;
  tx?: Prisma.TransactionClient;
}): Promise<Record<string, string | number>> {
  const dbClient = input.tx ?? db;
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

  const reservation = await dbClient.reservation.findUnique({
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
    applyReservationAmountUpdate({
      eventKind: input.eventKind,
      reservationTotalAmount: reservation.totalAmount,
      signals: input.signals,
      updates,
      applied,
      skipped,
    });
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

    applyReservationAmountUpdate({
      eventKind: input.eventKind,
      reservationTotalAmount: reservation.totalAmount,
      signals: input.signals,
      updates,
      applied,
      skipped,
    });
  }

  if (Object.keys(updates).length === 0) {
    airbnbEmailLog.info("enrichment_noop", {
      reservationId: input.match.reservationId,
      mode,
      skipped: skipped.join(",") || undefined,
    });
    return {};
  }

  await dbClient.reservation.update({
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
