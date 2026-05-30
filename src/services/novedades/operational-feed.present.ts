import { formatDate, formatDateRange } from "@/lib/helpers/date";
import { formatMoney } from "@/lib/format-currency";
import type { OperationalFeedCard, OperationalFeedKind } from "@/services/novedades/operational-feed.types";

const HEADLINES: Record<OperationalFeedKind, string> = {
  GUEST_MESSAGE: "Nuevo mensaje",
  MODIFICATION_REQUEST: "Solicitud de modificación",
  MODIFICATION_APPROVED: "Reserva actualizada",
  PAYOUT_SENT: "Airbnb envió un pago a tu cuenta",
  NEW_RESERVATION: "Nueva reserva confirmada",
  UPCOMING_CHECKIN: "Llegada próxima",
  UPCOMING_CHECKOUT: "Salida próxima",
  RESERVATION_CANCELLED: "Reserva cancelada",
};

const EMOJIS: Record<OperationalFeedKind, string> = {
  GUEST_MESSAGE: "💬",
  MODIFICATION_REQUEST: "⚠️",
  MODIFICATION_APPROVED: "🔄",
  PAYOUT_SENT: "💰",
  NEW_RESERVATION: "✅",
  UPCOMING_CHECKIN: "🛬",
  UPCOMING_CHECKOUT: "🛫",
  RESERVATION_CANCELLED: "❌",
};

export function formatOperationalRelativeTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - value.getTime();
  if (diffMs < 60_000) return "Ahora";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;

  return formatDate(value);
}

export function formatReservationRange(checkIn: Date, checkOut: Date): string {
  return formatDateRange(checkIn, checkOut);
}

export function formatGuestCountLine(input: {
  adults: number;
  children: number;
  infants: number;
}): string | null {
  const parts: string[] = [];
  if (input.adults > 0) {
    parts.push(`${input.adults} adulto${input.adults === 1 ? "" : "s"}`);
  }
  if (input.children > 0) {
    parts.push(`${input.children} niño${input.children === 1 ? "" : "s"}`);
  }
  if (input.infants > 0) {
    parts.push(`${input.infants} bebé${input.infants === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildOperationalCard(input: {
  id: string;
  kind: OperationalFeedKind;
  createdAt: Date;
  guestName?: string | null;
  summary?: string | null;
  propertyLabel?: string | null;
  propertyId?: string | null;
  reservationId?: string | null;
  confirmationCode?: string | null;
  amountLabel?: string | null;
  dateRangeLabel?: string | null;
  detailLines?: string[];
}): OperationalFeedCard {
  return {
    id: input.id,
    kind: input.kind,
    emoji: EMOJIS[input.kind],
    headline: HEADLINES[input.kind],
    guestName: input.guestName?.trim() || null,
    summary: input.summary?.trim() || null,
    propertyLabel: input.propertyLabel?.trim() || null,
    propertyId: input.propertyId ?? null,
    reservationId: input.reservationId ?? null,
    confirmationCode: input.confirmationCode?.trim() || null,
    amountLabel: input.amountLabel ?? null,
    dateRangeLabel: input.dateRangeLabel ?? null,
    detailLines: input.detailLines ?? [],
    relativeTime: formatOperationalRelativeTime(input.createdAt),
    createdAt: input.createdAt.toISOString(),
  };
}

export function formatPayoutAmount(amount: number | null | undefined, currency: string): string | null {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return formatMoney(Number(amount), currency);
}

export function quoteSummary(text: string | null | undefined): string | null {
  const value = text?.trim();
  if (!value) return null;
  const clipped = value.length > 220 ? `${value.slice(0, 217).trim()}…` : value;
  return `“${clipped}”`;
}
