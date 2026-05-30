import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import type { ModificationEventMetadata } from "@/modules/reservation-events/types";

function stripNoise(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractSectionAfterLabel(body: string, labelPattern: RegExp): string | null {
  const match = labelPattern.exec(body);
  if (!match) return null;
  const start = match.index + match[0].length;
  const tail = body.slice(start);
  const nextBreak = tail.search(/\n\s*\n|fechas solicitadas|fechas originales|check-?in|check-?out/i);
  const chunk = nextBreak >= 0 ? tail.slice(0, nextBreak) : tail.slice(0, 240);
  const cleaned = stripNoise(chunk);
  return cleaned.length > 0 ? cleaned : null;
}

function extractGuestFromRequestSubject(subject: string): string | null {
  const match = subject.match(
    /^(.+?)\s+quiere hacer un cambio en su reserva/i,
  );
  if (!match?.[1]) return null;
  const guest = stripNoise(match[1]);
  return guest.length > 0 ? guest : null;
}

function extractGuestFromApprovedBlob(blob: string): string | null {
  const match = blob.match(/tu reserva con\s+(.+?)\s+se ha actualizado/i);
  if (!match?.[1]) return null;
  const guest = stripNoise(match[1]);
  return guest.length > 0 ? guest : null;
}

export function extractModificationEventMetadata(input: {
  eventKind: "MODIFICATION_REQUEST" | "MODIFICATION_APPROVED";
  subject: string;
  body: string;
  signals?: ExtractedReservationSignals;
}): ModificationEventMetadata {
  const guestFromSignals = input.signals?.guestName?.trim() || null;
  const propertyLabel =
    input.signals?.listingName?.trim() ||
    input.signals?.unitNumber?.trim() ||
    null;

  if (input.eventKind === "MODIFICATION_REQUEST") {
    const originalRaw = extractSectionAfterLabel(
      input.body,
      /fechas originales\s*:?\s*/i,
    );
    const requestedRaw = extractSectionAfterLabel(
      input.body,
      /fechas solicitadas\s*:?\s*/i,
    );

    return {
      guestName: extractGuestFromRequestSubject(input.subject) ?? guestFromSignals,
      propertyLabel,
      originalDates: originalRaw ? { raw: originalRaw } : null,
      requestedDates: requestedRaw ? { raw: requestedRaw } : null,
      subject: input.subject,
      confirmationCode: input.signals?.confirmationCode ?? null,
    };
  }

  const blob = `${input.subject}\n${input.body}`;
  return {
    guestName: extractGuestFromApprovedBlob(blob) ?? guestFromSignals,
    propertyLabel,
    subject: input.subject,
    confirmationCode: input.signals?.confirmationCode ?? null,
  };
}

export function buildModificationEventDescription(
  eventKind: "MODIFICATION_REQUEST" | "MODIFICATION_APPROVED",
  metadata: ModificationEventMetadata,
): string {
  const guest = metadata.guestName ? `Huésped: ${metadata.guestName}.` : "";
  const property = metadata.propertyLabel ? ` Propiedad: ${metadata.propertyLabel}.` : "";

  if (eventKind === "MODIFICATION_REQUEST") {
    const original = metadata.originalDates?.raw
      ? ` Fechas originales: ${metadata.originalDates.raw}.`
      : "";
    const requested = metadata.requestedDates?.raw
      ? ` Fechas solicitadas: ${metadata.requestedDates.raw}.`
      : "";
    return stripNoise(
      `Solicitud de cambio detectada en correo Airbnb.${guest}${property}${original}${requested}`,
    );
  }

  return stripNoise(
    `Airbnb confirmó una actualización de reserva.${guest}${property}`,
  );
}

export function titleForModificationEventKind(
  eventKind: "MODIFICATION_REQUEST" | "MODIFICATION_APPROVED",
): string {
  return eventKind === "MODIFICATION_REQUEST"
    ? "Solicitud de modificación de reserva"
    : "Modificación de reserva aprobada";
}
