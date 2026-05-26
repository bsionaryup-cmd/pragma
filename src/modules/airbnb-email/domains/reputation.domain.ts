import type { Prisma } from "@prisma/client";
import {
  AirbnbEmailEventKind,
  AirbnbEmailReviewStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import type {
  ExtractedReservationSignals,
  ReservationMatchResult,
} from "@/modules/airbnb-email/types";

const REVIEW_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.HOST_REVIEW_REQUESTED,
  AirbnbEmailEventKind.GUEST_REVIEW_SUBMITTED,
  AirbnbEmailEventKind.GUEST_REVIEW_PUBLISHED,
]);

export function isReputationEventKind(kind: AirbnbEmailEventKind): boolean {
  return REVIEW_KINDS.has(kind);
}

function reviewStatusForKind(
  kind: AirbnbEmailEventKind,
): AirbnbEmailReviewStatus {
  switch (kind) {
    case AirbnbEmailEventKind.GUEST_REVIEW_SUBMITTED:
      return AirbnbEmailReviewStatus.SUBMITTED;
    case AirbnbEmailEventKind.GUEST_REVIEW_PUBLISHED:
      return AirbnbEmailReviewStatus.PUBLISHED;
    case AirbnbEmailEventKind.HOST_REVIEW_REQUESTED:
    default:
      return AirbnbEmailReviewStatus.REQUESTED;
  }
}

export async function persistReservationReview(input: {
  auditId: string;
  eventKind: AirbnbEmailEventKind;
  match: ReservationMatchResult;
  signals: ExtractedReservationSignals;
  payload: Prisma.InputJsonValue;
}) {
  const reviewStatus = reviewStatusForKind(input.eventKind);

  await db.reservationReview.create({
    data: {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      rating: input.signals.rating ?? undefined,
      reviewText: input.signals.reviewText,
      responsePending:
        input.eventKind === AirbnbEmailEventKind.HOST_REVIEW_REQUESTED,
      reviewStatus,
      payload: input.payload,
    },
  });
}
