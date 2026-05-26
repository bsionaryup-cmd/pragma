import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import { db } from "@/lib/db";
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
  const enrichedFields = await maybeEnrichReservationCode(
    input.match,
    input.signals,
  );

  await db.reservationEmailEvent.create({
    data: {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      eventKind: input.eventKind,
      confirmationCode: input.signals.confirmationCode,
      matchMethod: input.match.method,
      matchConfidence: input.match.confidence,
      payload: input.payload,
      enrichedFields: enrichedFields ?? undefined,
    },
  });

  return enrichedFields;
}

/** Phase 1+: only `reservationCode` when high-confidence policy allows. */
async function maybeEnrichReservationCode(
  match: ReservationMatchResult,
  signals: ExtractedReservationSignals,
): Promise<Record<string, string> | null> {
  if (
    !match.reservationId ||
    !match.allowReservationEnrichment ||
    !signals.confirmationCode?.trim()
  ) {
    return null;
  }

  const existing = await db.reservation.findUnique({
    where: { id: match.reservationId },
    select: { reservationCode: true },
  });

  if (existing?.reservationCode?.trim() === signals.confirmationCode.trim()) {
    return null;
  }

  await db.reservation.update({
    where: { id: match.reservationId },
    data: { reservationCode: signals.confirmationCode.trim() },
  });

  return { reservationCode: signals.confirmationCode.trim() };
}
