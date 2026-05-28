import { db } from "@/lib/db";

function readJsonFieldAsString(
  value: unknown,
  field: string,
): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const raw = obj[field];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function extractGuestNameFromReservationEmailEvent(input: {
  enrichedFields: unknown;
  payload: unknown;
}): string | null {
  const fromEnriched = readJsonFieldAsString(input.enrichedFields, "guestName");
  if (fromEnriched) return fromEnriched;
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return null;
  }
  const payload = input.payload as Record<string, unknown>;
  const signals =
    payload.signals && typeof payload.signals === "object" && !Array.isArray(payload.signals)
      ? (payload.signals as Record<string, unknown>)
      : null;
  if (!signals) return null;
  const fromSignals = signals.guestName;
  return typeof fromSignals === "string" && fromSignals.trim()
    ? fromSignals.trim()
    : null;
}

export async function getAirbnbEnrichedGuestNameByReservationIds(
  reservationIds: string[],
): Promise<Map<string, string>> {
  if (reservationIds.length === 0) return new Map();
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

  const byReservation = new Map<string, string>();
  for (const event of events) {
    if (!event.reservationId || byReservation.has(event.reservationId)) continue;
    const name = extractGuestNameFromReservationEmailEvent({
      enrichedFields: event.enrichedFields,
      payload: event.payload,
    });
    if (name) byReservation.set(event.reservationId, name);
  }
  return byReservation;
}
