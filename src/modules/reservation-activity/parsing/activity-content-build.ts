import type { ReservationActivityType } from "@prisma/client";
import {
  buildModificationEventDescription,
  extractModificationEventMetadata,
} from "@/modules/reservation-events/parsing/modification-metadata-extract";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import type { ActivityMetadata } from "@/modules/reservation-activity/types";
import { isPreReservationInquirySubject } from "@/services/novedades/novedades-unlinked-inquiry.logic";
import { normalizeGuestMessageBody } from "@/services/novedades/operational-feed.message";

function stripNoise(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const RAW_MESSAGE_MAX = 8000;

function pickRawMessageSource(input: {
  messageBody?: string | null;
  body: string;
}): string {
  const messageBody = input.messageBody?.trim();
  if (messageBody) return messageBody.slice(0, RAW_MESSAGE_MAX);
  return input.body.trim().slice(0, RAW_MESSAGE_MAX);
}

function extractMessageContent(input: {
  messageBody?: string | null;
  body: string;
  guestName?: string | null;
}): { content: string; rawMessageBody: string } {
  const rawMessageBody = pickRawMessageSource(input);
  const quoted = input.body.match(/"([^"]{4,800})"/)?.[1]?.trim();
  const sources = [input.messageBody, quoted, input.body].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  for (const source of sources) {
    const normalized = normalizeGuestMessageBody(source, {
      guestName: input.guestName,
    });
    if (normalized) {
      return { content: normalized, rawMessageBody };
    }
  }

  return { content: rawMessageBody, rawMessageBody };
}

function parseSenderName(from: string | null | undefined): string | null {
  if (!from?.trim()) return null;
  const match = from.match(/^([^<]+)</);
  if (match?.[1]) {
    const name = stripNoise(match[1].replace(/"/g, ""));
    return name.length > 0 ? name : null;
  }
  return null;
}

function parseSenderEmail(from: string | null | undefined): string | null {
  if (!from?.trim()) return null;
  const match = from.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  if (from.includes("@")) return from.trim().toLowerCase();
  return null;
}

export function buildActivityContent(input: {
  activityType: ReservationActivityType;
  subject: string;
  body: string;
  from?: string | null;
  signals?: ExtractedReservationSignals;
  confidence?: number | null;
}): {
  title: string;
  content: string;
  senderName: string | null;
  senderEmail: string | null;
  metadata: ActivityMetadata;
} {
  const senderEmail = parseSenderEmail(input.from);
  const guestFromSignals = input.signals?.guestName?.trim() || null;

  if (input.activityType === "MODIFICATION_REQUEST") {
    const metadata = extractModificationEventMetadata({
      eventKind: "MODIFICATION_REQUEST",
      subject: input.subject,
      body: input.body,
      signals: input.signals,
    }) satisfies ActivityMetadata;

    return {
      title: "Solicitud de modificación",
      content: buildModificationEventDescription("MODIFICATION_REQUEST", metadata),
      senderName: metadata.guestName ?? guestFromSignals ?? parseSenderName(input.from),
      senderEmail,
      metadata: {
        ...metadata,
        classificationConfidence: input.confidence ?? null,
      },
    };
  }

  if (input.activityType === "MODIFICATION_APPROVED") {
    const metadata = extractModificationEventMetadata({
      eventKind: "MODIFICATION_APPROVED",
      subject: input.subject,
      body: input.body,
      signals: input.signals,
    }) satisfies ActivityMetadata;

    return {
      title: "Modificación aprobada",
      content: "Airbnb confirmó la actualización de la reserva.",
      senderName: metadata.guestName ?? guestFromSignals ?? "Airbnb",
      senderEmail,
      metadata: {
        ...metadata,
        classificationConfidence: input.confidence ?? null,
      },
    };
  }

  if (input.activityType === "UNMATCHED_AIRBNB") {
    const rawMessageBody = pickRawMessageSource({
      messageBody: input.signals?.messageBody,
      body: input.body,
    });
    const excerpt = stripNoise(input.body).slice(0, 480);
    return {
      title: "Correo Airbnb pendiente de asociar",
      content: excerpt || input.subject,
      senderName: guestFromSignals ?? parseSenderName(input.from),
      senderEmail,
      metadata: {
        guestName: guestFromSignals,
        propertyLabel:
          input.signals?.listingName?.trim() ||
          input.signals?.unitNumber?.trim() ||
          null,
        subject: input.subject,
        confirmationCode: input.signals?.confirmationCode ?? null,
        classificationConfidence: input.confidence ?? null,
        rawMessageBody,
      },
    };
  }

  const guestName = guestFromSignals ?? parseSenderName(input.from);
  const { content, rawMessageBody } = extractMessageContent({
    messageBody: input.signals?.messageBody,
    body: input.body,
    guestName,
  });
  const isInquiry = isPreReservationInquirySubject(input.subject);

  return {
    title: isInquiry ? "Consulta" : "Mensaje Airbnb",
    content,
    senderName: guestName ?? "Huésped",
    senderEmail,
    metadata: {
      guestName: guestFromSignals,
      propertyLabel:
        input.signals?.listingName?.trim() ||
        input.signals?.unitNumber?.trim() ||
        null,
      subject: input.subject,
      confirmationCode: input.signals?.confirmationCode ?? null,
      classificationConfidence: input.confidence ?? null,
      rawMessageBody,
      isInquiry,
    },
  };
}
