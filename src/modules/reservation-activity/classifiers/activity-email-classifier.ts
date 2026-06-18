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
    /\bmessage from\b/.test(normalized) ||
    /\bpersona que reserva\b/.test(normalized) ||
    /\bperson who(?:'s| is) booking\b/.test(normalized)
  );
}

function looksLikeGuestMessageSubject(subject: string): boolean {
  const normalized = normalizeForMatch(subject);
  return (
    /te envi[oó] un mensaje/.test(normalized) ||
    /envi[oó] un mensaje sobre su reserva/.test(normalized) ||
    /message from .+ about/.test(normalized) ||
    /new message about your reservation/.test(normalized) ||
    /^re:\s*reserva de/.test(normalized) ||
    /^re:\s*consulta sobre/.test(normalized)
  );
}

export function isLikelyGuestMessageEmail(input: {
  subject: string;
  body: string;
  messageBody?: string | null;
}): boolean {
  if (looksLikeGuestMessageSubject(input.subject)) return true;
  if (looksLikeGuestMessage(input.body)) return true;
  const messageText = input.messageBody?.trim() || "";
  return messageText.length >= 12 && looksLikeGuestMessage(messageText);
}

function isNonGuestMessageOperationalEmail(input: {
  subject: string;
  body: string;
  pipelineEventKind?: AirbnbEmailEventKind | null;
}): boolean {
  if (isLikelyGuestMessageEmail(input)) {
    return false;
  }

  const subject = normalizeForMatch(input.subject);
  const body = normalizeForMatch(input.body);

  if (
    input.pipelineEventKind &&
    input.pipelineEventKind !== AirbnbEmailEventKind.RESERVATION_MESSAGE &&
    input.pipelineEventKind !== AirbnbEmailEventKind.UNKNOWN
  ) {
    return true;
  }

  if (
    /^(fwd:\s*)?reserva confirmada:/.test(subject) ||
    /^recordatorio de reserva:/.test(subject) ||
    /^te hemos enviado un cobro/.test(subject) ||
    /^consulta sobre .+ para el periodo/.test(subject) ||
    /^consulta para una estancia en/.test(subject) ||
    /preaprobar o rechazar/.test(body)
  ) {
    return true;
  }

  if (/^re:\s*consulta sobre/.test(subject)) {
    return true;
  }

  return false;
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

  if (isNonGuestMessageOperationalEmail(input)) {
    return null;
  }

  if (input.pipelineEventKind === AirbnbEmailEventKind.RESERVATION_MESSAGE) {
    return { activityType: ReservationActivityType.AIRBNB_MESSAGE, confidence: 0.95 };
  }

  if (looksLikeGuestMessageSubject(input.subject)) {
    return { activityType: ReservationActivityType.AIRBNB_MESSAGE, confidence: 0.9 };
  }

  if (looksLikeGuestMessage(input.body)) {
    return { activityType: ReservationActivityType.AIRBNB_MESSAGE, confidence: 0.82 };
  }

  const messageText = input.messageBody?.trim() || "";
  if (messageText.length >= 12 && looksLikeGuestMessage(messageText)) {
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
