import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { buildEmailBody } from "@/modules/airbnb-email/parsing/extractors";
import { classifyModificationObservabilityEvent } from "@/modules/reservation-events/classifiers/modification-event-classifier";
import {
  buildModificationEventDescription,
  extractModificationEventMetadata,
  titleForModificationEventKind,
} from "@/modules/reservation-events/parsing/modification-metadata-extract";
import {
  persistReservationObservabilityEvent,
  resolvePropertyIdForObservability,
} from "@/modules/reservation-events/services/persist-reservation-event";
import type { RecordModificationFromEmailInput } from "@/modules/reservation-events/types";

/**
 * Observability-only hook. Never mutates reservations, calendar, or automations.
 * Safe to call after the main Airbnb email pipeline completes.
 */
export async function recordModificationObservabilityFromInboundEmail(
  input: RecordModificationFromEmailInput,
): Promise<{
  recorded: boolean;
  eventType?: string;
  eventId?: string;
  confidence?: number;
}> {
  if (!input.auditId?.trim()) {
    return { recorded: false };
  }

  const body = buildEmailBody({
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  const classification = classifyModificationObservabilityEvent({
    subject: input.subject,
    body,
  });

  if (!classification) {
    return { recorded: false };
  }

  const { kind: eventKind, confidence } = classification;

  airbnbEmailLog.info("modification_observability_classified", {
    auditId: input.auditId,
    rawSubject: input.subject.slice(0, 240),
    eventType: eventKind,
    confidence,
    organizationId: input.organizationId ?? undefined,
  });

  const metadata = extractModificationEventMetadata({
    eventKind,
    subject: input.subject,
    body,
    signals: input.signals,
  });

  const propertyId = await resolvePropertyIdForObservability({
    reservationId: input.reservationId ?? null,
    propertyId: input.propertyId ?? null,
  });

  const result = await persistReservationObservabilityEvent({
    organizationId: input.organizationId,
    reservationId: input.reservationId ?? null,
    propertyId,
    eventType: eventKind,
    title: titleForModificationEventKind(eventKind),
    description: buildModificationEventDescription(eventKind, metadata),
    metadata,
    sourceEmailId: input.auditId,
    rawSubject: input.subject,
    classificationConfidence: confidence,
  });

  if (result.created) {
    airbnbEmailLog.info("modification_observability_recorded", {
      auditId: input.auditId,
      rawSubject: input.subject.slice(0, 240),
      eventType: eventKind,
      confidence,
      eventId: result.id,
      organizationId: input.organizationId ?? undefined,
      reservationId: input.reservationId ?? undefined,
      propertyId: propertyId ?? undefined,
    });
  } else {
    airbnbEmailLog.info("modification_observability_duplicate_skipped", {
      auditId: input.auditId,
      eventType: eventKind,
      confidence,
      eventId: result.id,
    });
  }

  return {
    recorded: result.created,
    eventType: eventKind,
    eventId: result.id,
    confidence,
  };
}
