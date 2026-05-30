import { db } from "@/lib/db";
import type { GuestCountEnrichment } from "@/lib/reservations/display-guest-count";
import { extractGuestCountSignals } from "@/modules/airbnb-email/parsing/guest-count-extract";

function readNumberField(value: unknown, field: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[field];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function totalFromGuestCountEnrichment(counts: GuestCountEnrichment): number | null {
  if (counts.guestCountTotal != null && counts.guestCountTotal > 0) {
    return counts.guestCountTotal;
  }
  if (counts.adultCount != null && counts.adultCount > 0) {
    return (
      counts.adultCount +
      Math.max(0, counts.childCount ?? 0) +
      Math.max(0, counts.infantCount ?? 0)
    );
  }
  return null;
}

function readGuestCountsFromRecord(record: unknown): GuestCountEnrichment | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;

  const adultCount = readNumberField(record, "adultCount");
  const childCount = readNumberField(record, "childCount");
  const infantCount = readNumberField(record, "infantCount");
  const guestCountTotal =
    readNumberField(record, "guestCountTotal") ?? readNumberField(record, "guestCount");

  if (
    adultCount == null &&
    childCount == null &&
    infantCount == null &&
    guestCountTotal == null
  ) {
    return null;
  }

  return { adultCount, childCount, infantCount, guestCountTotal };
}

function mergeGuestCountEnrichment(
  primary: GuestCountEnrichment | null,
  fallback: GuestCountEnrichment | null,
): GuestCountEnrichment | null {
  if (!primary && !fallback) return null;
  return {
    adultCount: primary?.adultCount ?? fallback?.adultCount ?? null,
    childCount: primary?.childCount ?? fallback?.childCount ?? null,
    infantCount: primary?.infantCount ?? fallback?.infantCount ?? null,
    guestCountTotal: primary?.guestCountTotal ?? fallback?.guestCountTotal ?? null,
  };
}

export function extractGuestCountsFromReservationEmailEvent(input: {
  enrichedFields: unknown;
  payload: unknown;
}): GuestCountEnrichment | null {
  let counts = readGuestCountsFromRecord(input.enrichedFields);

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return counts;
  }

  const payload = input.payload as Record<string, unknown>;
  const signals = payload.signals;
  counts = mergeGuestCountEnrichment(counts, readGuestCountsFromRecord(signals));

  const emailMatchBlob = readStringField(signals, "emailMatchBlob");
  if (emailMatchBlob) {
    const fallback = extractGuestCountSignals(emailMatchBlob);
    counts = mergeGuestCountEnrichment(counts, {
      adultCount: fallback.adultCount,
      childCount: fallback.childCount,
      infantCount: fallback.infantCount,
      guestCountTotal: fallback.guestCountTotal,
    });
  }

  return counts;
}

export function extractGuestCountsFromAuditPayload(
  parsedPayload: unknown,
): GuestCountEnrichment | null {
  if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
    return null;
  }

  const payload = parsedPayload as Record<string, unknown>;
  const signals = payload.signals;
  let counts = readGuestCountsFromRecord(signals);

  const emailMatchBlob = readStringField(signals, "emailMatchBlob");
  if (emailMatchBlob) {
    const fallback = extractGuestCountSignals(emailMatchBlob);
    counts = mergeGuestCountEnrichment(counts, {
      adultCount: fallback.adultCount,
      childCount: fallback.childCount,
      infantCount: fallback.infantCount,
      guestCountTotal: fallback.guestCountTotal,
    });
  }

  return counts;
}

export function extractGuestCountFromReservationEmailEvent(input: {
  enrichedFields: unknown;
  payload: unknown;
}): number | null {
  const counts = extractGuestCountsFromReservationEmailEvent(input);
  return counts ? totalFromGuestCountEnrichment(counts) : null;
}

export function extractGuestCountFromAuditPayload(parsedPayload: unknown): number | null {
  const counts = extractGuestCountsFromAuditPayload(parsedPayload);
  return counts ? totalFromGuestCountEnrichment(counts) : null;
}

export async function getAirbnbEnrichedGuestCountsByReservationIds(
  reservationIds: string[],
): Promise<Map<string, GuestCountEnrichment>> {
  if (reservationIds.length === 0) return new Map();

  const byReservation = new Map<string, GuestCountEnrichment>();

  const events = await db.reservationEmailEvent.findMany({
    where: {
      reservationId: { in: reservationIds },
    },
    select: {
      reservationId: true,
      enrichedFields: true,
      payload: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  for (const event of events) {
    if (!event.reservationId || byReservation.has(event.reservationId)) continue;
    const counts = extractGuestCountsFromReservationEmailEvent({
      enrichedFields: event.enrichedFields,
      payload: event.payload,
    });
    if (counts) byReservation.set(event.reservationId, counts);
  }

  const missingAfterEvents = reservationIds.filter((id) => !byReservation.has(id));
  if (missingAfterEvents.length > 0) {
    const audits = await db.emailIngestionAudit.findMany({
      where: { reservationId: { in: missingAfterEvents } },
      select: {
        reservationId: true,
        parsedPayload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    for (const audit of audits) {
      if (!audit.reservationId || byReservation.has(audit.reservationId)) continue;
      const counts = extractGuestCountsFromAuditPayload(audit.parsedPayload);
      if (counts) byReservation.set(audit.reservationId, counts);
    }
  }

  return byReservation;
}

export async function getAirbnbEnrichedGuestCountByReservationIds(
  reservationIds: string[],
): Promise<Map<string, number>> {
  if (reservationIds.length === 0) return new Map();

  const byReservation = new Map<string, number>();
  const enrichedCounts = await getAirbnbEnrichedGuestCountsByReservationIds(
    reservationIds,
  );

  for (const [reservationId, counts] of enrichedCounts) {
    const total = totalFromGuestCountEnrichment(counts);
    if (total != null) byReservation.set(reservationId, total);
  }

  return byReservation;
}
