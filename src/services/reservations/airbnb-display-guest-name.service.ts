import { BookingPlatform } from "@prisma/client";
import { db } from "@/lib/db";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";

function readJsonFieldAsString(
  value: unknown,
  field: string,
): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const raw = obj[field];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readGuestNameFromSignals(signals: unknown): string | null {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  const guestName = (signals as Record<string, unknown>).guestName;
  return typeof guestName === "string" && guestName.trim() ? guestName.trim() : null;
}

export function extractGuestNameFromReservationEmailEvent(input: {
  enrichedFields: unknown;
  payload: unknown;
}): string | null {
  const fromEnriched = readJsonFieldAsString(input.enrichedFields, "guestName");
  if (fromEnriched && !isPlaceholderGuestName(fromEnriched)) return fromEnriched;
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return null;
  }
  const payload = input.payload as Record<string, unknown>;
  const fromSignals = readGuestNameFromSignals(payload.signals);
  if (fromSignals && !isPlaceholderGuestName(fromSignals)) return fromSignals;
  return null;
}

export function extractGuestNameFromAuditPayload(parsedPayload: unknown): string | null {
  if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
    return null;
  }
  const payload = parsedPayload as Record<string, unknown>;
  const fromSignals = readGuestNameFromSignals(payload.signals);
  if (fromSignals && !isPlaceholderGuestName(fromSignals)) return fromSignals;
  return null;
}

/**
 * Best-effort guest name from Airbnb email enrichment for display across PMS views.
 * Priority: reservation email event → linked ingestion audit → non-placeholder reservation row.
 */
export async function getAirbnbEnrichedGuestNameByReservationIds(
  reservationIds: string[],
): Promise<Map<string, string>> {
  if (reservationIds.length === 0) return new Map();

  const byReservation = new Map<string, string>();

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
    const name = extractGuestNameFromReservationEmailEvent({
      enrichedFields: event.enrichedFields,
      payload: event.payload,
    });
    if (name) byReservation.set(event.reservationId, name);
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
      const name = extractGuestNameFromAuditPayload(audit.parsedPayload);
      if (name) byReservation.set(audit.reservationId, name);
    }
  }

  const missingAfterAudits = reservationIds.filter((id) => !byReservation.has(id));
  if (missingAfterAudits.length > 0) {
    const rows = await db.reservation.findMany({
      where: {
        id: { in: missingAfterAudits },
        platform: BookingPlatform.AIRBNB,
      },
      select: { id: true, guestName: true },
    });

    for (const row of rows) {
      const name = row.guestName?.trim();
      if (name && !isPlaceholderGuestName(name)) {
        byReservation.set(row.id, name);
      }
    }
  }

  return byReservation;
}
