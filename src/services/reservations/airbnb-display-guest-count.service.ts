import { db } from "@/lib/db";
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

function readGuestCountFromSignals(signals: unknown): number | null {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  const record = signals as Record<string, unknown>;
  return (
    readNumberField(record, "guestCountTotal") ??
    readNumberField(record, "guestCount")
  );
}

export function extractGuestCountFromReservationEmailEvent(input: {
  enrichedFields: unknown;
  payload: unknown;
}): number | null {
  const fromEnriched = readNumberField(input.enrichedFields, "guestCountTotal");
  if (fromEnriched != null && fromEnriched > 0) return fromEnriched;

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return null;
  }
  const payload = input.payload as Record<string, unknown>;
  const signals = payload.signals;
  const fromSignals = readGuestCountFromSignals(signals);
  if (fromSignals != null && fromSignals > 0) return fromSignals;

  const emailMatchBlob = readStringField(signals, "emailMatchBlob");
  if (emailMatchBlob) {
    const fallback = extractGuestCountSignals(emailMatchBlob);
    if (fallback.guestCountTotal != null && fallback.guestCountTotal > 0) {
      return fallback.guestCountTotal;
    }
  }

  return null;
}

export function extractGuestCountFromAuditPayload(parsedPayload: unknown): number | null {
  if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
    return null;
  }
  const payload = parsedPayload as Record<string, unknown>;
  const signals = payload.signals;
  const fromSignals = readGuestCountFromSignals(signals);
  if (fromSignals != null && fromSignals > 0) return fromSignals;

  const emailMatchBlob = readStringField(signals, "emailMatchBlob");
  if (emailMatchBlob) {
    const fallback = extractGuestCountSignals(emailMatchBlob);
    if (fallback.guestCountTotal != null && fallback.guestCountTotal > 0) {
      return fallback.guestCountTotal;
    }
  }

  return null;
}

export async function getAirbnbEnrichedGuestCountByReservationIds(
  reservationIds: string[],
): Promise<Map<string, number>> {
  if (reservationIds.length === 0) return new Map();

  const byReservation = new Map<string, number>();

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
    const count = extractGuestCountFromReservationEmailEvent({
      enrichedFields: event.enrichedFields,
      payload: event.payload,
    });
    if (count != null) byReservation.set(event.reservationId, count);
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
      const count = extractGuestCountFromAuditPayload(audit.parsedPayload);
      if (count != null) byReservation.set(audit.reservationId, count);
    }
  }

  return byReservation;
}
