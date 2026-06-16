import { AirbnbEmailEventKind, BookingPlatform } from "@prisma/client";
import { db } from "@/lib/db";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { confirmationCodesConflict } from "@/modules/airbnb-email/matching/confirmation-code-guard";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";

const CONFIRMED_GUEST_NAME_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
]);

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

function isDisplayableGuestName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return !isPlaceholderGuestName(name) && isPlausibleGuestName(name);
}

export function extractGuestNameFromReservationEmailEvent(input: {
  enrichedFields: unknown;
  /** @deprecated Display reads guestName from enrichedFields only; payload is ignored. */
  payload?: unknown;
}): string | null {
  const fromEnriched = readJsonFieldAsString(input.enrichedFields, "guestName");
  if (isDisplayableGuestName(fromEnriched)) return fromEnriched;
  return null;
}

export function extractGuestNameFromAuditPayload(parsedPayload: unknown): string | null {
  if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
    return null;
  }
  const payload = parsedPayload as Record<string, unknown>;
  const fromSignals = readGuestNameFromSignals(payload.signals);
  if (isDisplayableGuestName(fromSignals)) return fromSignals;
  return null;
}

function orderEventsForDisplayGuestName<
  T extends { eventKind: AirbnbEmailEventKind; createdAt: Date },
>(events: T[]): T[] {
  const confirmed = events.filter((event) =>
    CONFIRMED_GUEST_NAME_EVENT_KINDS.has(event.eventKind),
  );
  const other = events.filter(
    (event) => !CONFIRMED_GUEST_NAME_EVENT_KINDS.has(event.eventKind),
  );
  const byNewest = (a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime();
  return [...confirmed.sort(byNewest), ...other.sort(byNewest)];
}

/** Skip CONFIRMED events whose code disagrees with the reservation when both are known. */
export function isEmailEventEligibleForDisplayGuestName(input: {
  eventKind: AirbnbEmailEventKind;
  eventConfirmationCode: string | null | undefined;
  reservationCode: string | null | undefined;
}): boolean {
  if (!CONFIRMED_GUEST_NAME_EVENT_KINDS.has(input.eventKind)) return true;
  return !confirmationCodesConflict(
    input.eventConfirmationCode,
    input.reservationCode,
  );
}

export type ReservationEmailEventForDisplayGuestName = {
  eventKind: AirbnbEmailEventKind;
  confirmationCode: string | null;
  enrichedFields: unknown;
  createdAt: Date;
};

export function pickGuestNameFromReservationEmailEvents(input: {
  events: ReservationEmailEventForDisplayGuestName[];
  reservationCode: string | null | undefined;
}): string | null {
  const eligible = input.events.filter((event) =>
    isEmailEventEligibleForDisplayGuestName({
      eventKind: event.eventKind,
      eventConfirmationCode: event.confirmationCode,
      reservationCode: input.reservationCode,
    }),
  );

  for (const event of orderEventsForDisplayGuestName(eligible)) {
    const name = extractGuestNameFromReservationEmailEvent({
      enrichedFields: event.enrichedFields,
    });
    if (name) return name;
  }

  return null;
}

/**
 * Best-effort guest name from Airbnb email enrichment for display across PMS views.
 * Priority: CONFIRMED email events → other events → linked ingestion audit → reservation row.
 */
export async function getAirbnbEnrichedGuestNameByReservationIds(
  reservationIds: string[],
): Promise<Map<string, string>> {
  if (reservationIds.length === 0) return new Map();

  const byReservation = new Map<string, string>();

  const [events, reservationRows] = await Promise.all([
    db.reservationEmailEvent.findMany({
      where: {
        reservationId: { in: reservationIds },
      },
      select: {
        reservationId: true,
        eventKind: true,
        confirmationCode: true,
        enrichedFields: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { id: true, reservationCode: true },
    }),
  ]);

  const reservationCodeById = new Map(
    reservationRows.map((row) => [row.id, row.reservationCode]),
  );

  const eventsByReservation = new Map<string, typeof events>();
  for (const event of events) {
    if (!event.reservationId) continue;
    const bucket = eventsByReservation.get(event.reservationId) ?? [];
    bucket.push(event);
    eventsByReservation.set(event.reservationId, bucket);
  }

  for (const [reservationId, reservationEvents] of eventsByReservation) {
    const name = pickGuestNameFromReservationEmailEvents({
      events: reservationEvents,
      reservationCode: reservationCodeById.get(reservationId),
    });
    if (name) byReservation.set(reservationId, name);
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
      if (isDisplayableGuestName(name)) {
        byReservation.set(row.id, name!);
      }
    }
  }

  return byReservation;
}
