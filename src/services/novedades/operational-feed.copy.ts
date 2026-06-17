import type { BookingPlatform } from "@prisma/client";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import { isPlaceholderGuestName, normalizeGuestMessageBody } from "@/services/novedades/operational-feed.message";

/** Nombre legible en bandeja: evita placeholders de iCal y usa código si hace falta. */
export function resolveNovedadesGuestName(input: {
  guestName?: string | null;
  confirmationCode?: string | null;
  enrichedGuestName?: string | null;
  platform?: BookingPlatform | null;
}): string {
  const enriched = input.enrichedGuestName?.trim();
  if (enriched && !isPlaceholderGuestName(enriched)) return enriched;

  const raw = input.guestName?.trim();
  if (raw && !isPlaceholderGuestName(raw)) return raw;

  const code = input.confirmationCode?.trim();
  if (code) return `Reserva ${code}`;

  return input.platform === "AIRBNB" ? "Reserva Airbnb" : "Huésped sin nombre";
}

function guestLabel(card: Pick<OperationalFeedCard, "guestName" | "confirmationCode">): string {
  return resolveNovedadesGuestName({
    guestName: card.guestName,
    confirmationCode: card.confirmationCode,
  });
}

function plainMessage(
  summary: string | null | undefined,
  guestName?: string | null,
): string | null {
  return normalizeGuestMessageBody(summary, { guestName });
}

/** Frase legible para el anfitrión, estilo bandeja de actividad. */
export function buildFeedNarrative(card: OperationalFeedCard): string {
  const guest = guestLabel(card);
  const property = card.propertyLabel?.trim();
  const dates = card.dateRangeLabel?.trim();
  const stay = [property, dates].filter(Boolean).join(" · ");
  const message = plainMessage(card.summary, card.guestName);
  const detail = card.detailLines.filter(Boolean).join(" · ");

  switch (card.kind) {
    case "NEW_RESERVATION": {
      const amountPart = card.amountLabel ? ` · ${card.amountLabel}` : "";
      if (stay) return `Nueva reserva — ${stay}${amountPart}`;
      return `Nueva reserva confirmada${amountPart}.`;
    }
    case "RESERVATION_CANCELLED":
      return `${guest} canceló la reserva${dates ? ` del ${dates}` : ""}.`;
    case "MODIFICATION_REQUEST":
      if (detail) return `${guest} solicitó cambiar la reserva (${detail}).`;
      return `${guest} solicitó modificar la reserva.`;
    case "MODIFICATION_APPROVED":
      return `Airbnb confirmó los cambios de la reserva de ${guest}.`;
    case "RESERVATION_UPDATED":
      if (detail) return `Se actualizó la reserva de ${guest}: ${detail}.`;
      return `Se actualizaron fechas o datos de la reserva de ${guest}.`;
    case "STAY_EXTENDED":
      if (detail) return `${guest} extendió la estadía (${detail}).`;
      return `${guest} extendió la estadía.`;
    case "GUEST_MESSAGE":
      if (message) return message;
      return "Mensaje del huésped.";
    case "PAYMENT_CONFIRMED":
      if (card.amountLabel) {
        return `Pago recibido de ${guest}: ${card.amountLabel}.`;
      }
      return `Se confirmó un pago de ${guest}.`;
    case "PAYOUT_SENT":
      if (card.amountLabel) {
        return `Airbnb transfirió ${card.amountLabel} a tu cuenta.`;
      }
      return "Airbnb procesó el desembolso de esta reserva.";
    case "ALERT":
      if (message) return message;
      if (detail) return detail;
      return `La reserva de ${guest} requiere tu atención.`;
    default:
      return message ?? detail ?? card.headline;
  }
}

export function guestInitialsFromName(name: string | null | undefined): string {
  const value = name?.trim();
  if (!value || isPlaceholderGuestName(value)) return "?";
  if (value.startsWith("Reserva ")) {
    const code = value.slice("Reserva ".length).trim();
    return code.slice(0, 2).toUpperCase() || "R";
  }
  if (value === "Reserva Airbnb") return "RA";
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmada",
  CHECKED_IN: "En casa",
  CHECKOUT_TODAY: "Sale hoy",
  CHECKED_OUT: "Finalizada",
  CANCELLED: "Cancelada",
  BLOCKED: "Bloqueada",
};
