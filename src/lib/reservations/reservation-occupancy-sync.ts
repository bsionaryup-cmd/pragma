import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type ReservationOccupancy = {
  adults: number;
  children: number;
  infants: number;
};

export const OCCUPANCY_LIFECYCLE_UPDATE_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
]);

const OCCUPANCY_INITIAL_FILL_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
]);

export function isDefaultReservationOccupancy(
  adults: number,
  children: number,
  infants: number,
): boolean {
  return adults === 1 && children === 0 && infants === 0;
}

export function parseOccupancyFromEmailSignals(
  signals: ExtractedReservationSignals,
): ReservationOccupancy | null {
  const adultCount = signals.adultCount ?? null;
  const childCount = signals.childCount ?? null;
  const infantCount = signals.infantCount ?? null;

  if (adultCount != null && adultCount > 0) {
    return {
      adults: adultCount,
      children: Math.max(0, childCount ?? 0),
      infants: Math.max(0, infantCount ?? 0),
    };
  }

  const guestTotal = signals.guestCountTotal ?? signals.guestCount ?? null;
  if (guestTotal != null && guestTotal > 0) {
    return {
      adults: guestTotal,
      children: 0,
      infants: 0,
    };
  }

  return null;
}

export function occupancyMatchesReservation(
  occupancy: ReservationOccupancy,
  reservation: ReservationOccupancy,
): boolean {
  return (
    occupancy.adults === reservation.adults &&
    occupancy.children === reservation.children &&
    occupancy.infants === reservation.infants
  );
}

export function readAppliedOccupancyFromEnrichedFields(
  enrichedFields: unknown,
): ReservationOccupancy | null {
  if (!enrichedFields || typeof enrichedFields !== "object" || Array.isArray(enrichedFields)) {
    return null;
  }

  const record = enrichedFields as Record<string, unknown>;
  if (typeof record.adults !== "number" || record.adults <= 0) {
    return null;
  }

  return {
    adults: record.adults,
    children: typeof record.children === "number" ? Math.max(0, record.children) : 0,
    infants: typeof record.infants === "number" ? Math.max(0, record.infants) : 0,
  };
}

export async function getLatestAppliedOccupancyEventAt(
  dbClient: Prisma.TransactionClient | { reservationEmailEvent: Prisma.TransactionClient["reservationEmailEvent"] },
  reservationId: string,
): Promise<Date | null> {
  const events = await dbClient.reservationEmailEvent.findMany({
    where: { reservationId },
    select: { createdAt: true, enrichedFields: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const event of events) {
    if (readAppliedOccupancyFromEnrichedFields(event.enrichedFields)) {
      return event.createdAt;
    }
  }

  return null;
}

export function resolveOccupancyEnrichmentUpdate(input: {
  eventKind?: AirbnbEmailEventKind;
  reservation: ReservationOccupancy;
  signals: ExtractedReservationSignals;
  sourceEventAt?: Date | null;
  latestAppliedOccupancyEventAt?: Date | null;
}): {
  updates: Partial<ReservationOccupancy>;
  applied: Record<string, number>;
  skipped: string[];
} {
  const skipped: string[] = [];
  const applied: Record<string, number> = {};
  const updates: Partial<ReservationOccupancy> = {};

  const incoming = parseOccupancyFromEmailSignals(input.signals);
  if (!incoming) {
    skipped.push("occupancy_signals_missing");
    return { updates, applied, skipped };
  }

  if (occupancyMatchesReservation(incoming, input.reservation)) {
    skipped.push("occupancy_unchanged");
    return { updates, applied, skipped };
  }

  const isLifecycleUpdate =
    input.eventKind != null && OCCUPANCY_LIFECYCLE_UPDATE_KINDS.has(input.eventKind);
  const isInitialFill =
    input.eventKind == null ||
    OCCUPANCY_INITIAL_FILL_KINDS.has(input.eventKind);

  if (isLifecycleUpdate) {
    if (
      input.sourceEventAt &&
      input.latestAppliedOccupancyEventAt &&
      input.sourceEventAt.getTime() < input.latestAppliedOccupancyEventAt.getTime()
    ) {
      skipped.push("occupancy_stale_event");
      return { updates, applied, skipped };
    }
  } else if (isInitialFill) {
    if (!isDefaultReservationOccupancy(
      input.reservation.adults,
      input.reservation.children,
      input.reservation.infants,
    )) {
      skipped.push("occupancy_already_set");
      return { updates, applied, skipped };
    }
  } else {
    skipped.push("occupancy_event_kind");
    return { updates, applied, skipped };
  }

  updates.adults = incoming.adults;
  applied.adults = incoming.adults;

  const hasAdultBreakdown = input.signals.adultCount != null && input.signals.adultCount > 0;
  if (hasAdultBreakdown) {
    if (input.signals.childCount != null) {
      updates.children = incoming.children;
      applied.children = incoming.children;
    }
    if (input.signals.infantCount != null) {
      updates.infants = incoming.infants;
      applied.infants = incoming.infants;
    }
  } else {
    updates.children = 0;
    applied.children = 0;
    updates.infants = 0;
    applied.infants = 0;
  }

  return { updates, applied, skipped };
}
