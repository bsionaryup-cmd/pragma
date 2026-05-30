import { AirbnbEmailEventKind, ReservationActivityType } from "@prisma/client";
import { classifyModificationObservabilityEvent } from "@/modules/reservation-events/classifiers/modification-event-classifier";
import type { ActivityClassificationResult } from "@/modules/reservation-activity/types";

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function looksLikeGuestMessage(body: string): boolean {
  const normalized = normalizeForMatch(body);
  return (
    /^(hola|hi|hello|buenos dias|buenas tardes|buenas noches)\b/.test(normalized) ||
    /\bmensaje del huesped\b/.test(normalized) ||
    /\bmessage from\b/.test(normalized)
  );
}

export function classifyReservationActivityEmail(input: {
  subject: string;
  body: string;
  messageBody?: string | null;
  pipelineEventKind?: AirbnbEmailEventKind | null;
}): ActivityClassificationResult | null {
  const modification = classifyModificationObservabilityEvent({
    subject: input.subject,
    body: input.body,
  });

  if (modification?.kind === "MODIFICATION_REQUEST") {
    return {
      activityType: ReservationActivityType.MODIFICATION_REQUEST,
      confidence: modification.confidence,
    };
  }

  if (modification?.kind === "MODIFICATION_APPROVED") {
    return {
      activityType: ReservationActivityType.MODIFICATION_APPROVED,
      confidence: modification.confidence,
    };
  }

  if (input.pipelineEventKind === AirbnbEmailEventKind.RESERVATION_MESSAGE) {
    return { activityType: ReservationActivityType.AIRBNB_MESSAGE, confidence: 0.95 };
  }

  const messageText = input.messageBody?.trim() || "";
  if (messageText.length >= 12) {
    return { activityType: ReservationActivityType.AIRBNB_MESSAGE, confidence: 0.88 };
  }

  if (looksLikeGuestMessage(input.body)) {
    return { activityType: ReservationActivityType.AIRBNB_MESSAGE, confidence: 0.75 };
  }

  return null;
}

/** Always returns a capture type — unmatched Airbnb emails are stored for later association. */
export function resolveActivityCaptureType(input: {
  subject: string;
  body: string;
  messageBody?: string | null;
  pipelineEventKind?: AirbnbEmailEventKind | null;
}): ActivityClassificationResult {
  const classified = classifyReservationActivityEmail(input);
  if (classified) return classified;

  return {
    activityType: ReservationActivityType.UNMATCHED_AIRBNB,
    confidence: 0.5,
  };
}
