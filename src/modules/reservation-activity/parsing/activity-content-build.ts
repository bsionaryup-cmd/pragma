import type { ReservationActivityType } from "@prisma/client";
import {
  buildModificationEventDescription,
  extractModificationEventMetadata,
} from "@/modules/reservation-events/parsing/modification-metadata-extract";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import type { ActivityMetadata } from "@/modules/reservation-activity/types";

function stripNoise(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractMessageContent(input: {
  messageBody?: string | null;
  body: string;
}): string {
  const quoted = input.body.match(/"([^"]{8,})"/)?.[1]?.trim();
  const fromSignals = input.messageBody?.trim();

  const signalsLookLikeSubjectNoise =
    Boolean(fromSignals) &&
    (fromSignals!.length < 24 ||
      /sobre su reserva|te envi[oó] un mensaje|message from|mensaje de airbnb/i.test(
        fromSignals!,
      ));

  if (quoted && (!fromSignals || signalsLookLikeSubjectNoise)) {
    return stripNoise(quoted);
  }

  if (fromSignals && fromSignals.length > 0) return fromSignals;

  if (quoted) return stripNoise(quoted);

  const lines = input.body
    .split(/\n/)
    .map((line) => stripNoise(line))
    .filter((line) => line.length >= 16)
    .filter(
      (line) =>
        !/^(fechas originales|fechas solicitadas|responder|reply|unsubscribe)/i.test(
          line,
        ),
    );

  return lines[0]?.slice(0, 1200) ?? stripNoise(input.body).slice(0, 1200);
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
      },
    };
  }

  const message = extractMessageContent({
    messageBody: input.signals?.messageBody,
    body: input.body,
  });

  return {
    title: "Mensaje Airbnb",
    content: message,
    senderName: guestFromSignals ?? parseSenderName(input.from) ?? "Huésped",
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
    },
  };
}
