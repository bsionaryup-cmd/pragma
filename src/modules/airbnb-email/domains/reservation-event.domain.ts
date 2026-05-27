import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import { db } from "@/lib/db";
import { applySafeReservationEnrichment } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import type {
  ExtractedReservationSignals,
  ReservationMatchResult,
} from "@/modules/airbnb-email/types";

const RESERVATION_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.CANCELED,
  AirbnbEmailEventKind.EXTENDED,
]);

export function isReservationEventKind(kind: AirbnbEmailEventKind): boolean {
  return RESERVATION_EVENT_KINDS.has(kind);
}

export async function persistReservationEmailEvent(input: {
  auditId: string;
  eventKind: AirbnbEmailEventKind;
  match: ReservationMatchResult;
  signals: ExtractedReservationSignals;
  payload: Prisma.InputJsonValue;
}) {
  const enrichedFields = await applySafeReservationEnrichment({
    match: input.match,
    signals: input.signals,
    eventKind: input.eventKind,
    mode: "reservation",
  });

  await db.reservationEmailEvent.create({
    data: {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      eventKind: input.eventKind,
      confirmationCode: input.signals.confirmationCode,
      matchMethod: input.match.method,
      matchConfidence: input.match.confidence,
      payload: input.payload,
      enrichedFields:
        Object.keys(enrichedFields).length > 0 ? enrichedFields : undefined,
    },
  });

  return Object.keys(enrichedFields).length > 0 ? enrichedFields : null;
}
