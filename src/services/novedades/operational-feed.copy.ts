import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

function guestLabel(name: string | null | undefined): string {
  const value = name?.trim();
  return value && !isPlaceholderGuestName(value) ? value : "El huésped";
}

function isPlaceholderGuestName(name: string): boolean {
  return /^(hu[eé]sped airbnb|airbnb guest|airbnb|reserved|reservado)$/i.test(
    name.trim(),
  );
}

function plainMessage(summary: string | null | undefined): string | null {
  if (!summary?.trim()) return null;
  return summary.replace(/^[“"']|[”"']$/g, "").trim() || null;
}

/** Frase legible para el anfitrión, estilo bandeja de actividad. */
export function buildFeedNarrative(card: OperationalFeedCard): string {
  const guest = guestLabel(card.guestName);
  const property = card.propertyLabel?.trim();
  const dates = card.dateRangeLabel?.trim();
  const stay = [property, dates].filter(Boolean).join(" · ");
  const message = plainMessage(card.summary);
  const detail = card.detailLines.filter(Boolean).join(" · ");

  switch (card.kind) {
    case "NEW_RESERVATION":
      if (stay) return `Nueva reserva de ${guest} — ${stay}.`;
      return `Nueva reserva confirmada de ${guest}.`;
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
      if (message) return `${guest} escribió: ${message}`;
      return `${guest} envió un mensaje.`;
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
