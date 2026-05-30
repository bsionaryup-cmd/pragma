import type { PaymentStatus } from "@prisma/client";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";
import type { InboxConversation, InboxConversationStatus } from "@/types/inbox";
import {
  buildConversationMessages,
  getConversationPreview,
} from "@/features/inbox/lib/build-conversation-messages";
import {
  displayStatusLabels,
  resolveDisplayStatus,
} from "@/features/reservations/lib/reservation-status";
import {
  formatPropertyUnitDisplay,
  resolvePropertyUnit,
} from "@/lib/property-display";
import { formatDate, formatDateRange, formatPanelDate } from "@/lib/helpers/date";
import { isInboxConversationUnread } from "@/features/inbox/lib/inbox-unread";

type ReservationExtras = {
  paymentStatus: PaymentStatus;
  reservationCode: string | null;
  icalUid: string | null;
  updatedAt: Date;
};

function toInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T12:00:00`).getTime();
  const end = new Date(`${checkOut}T12:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function resolveBookingCode(reservation: ReservationInboxItem): string {
  if (reservation.reservationCode?.trim()) return reservation.reservationCode.trim();
  if (reservation.icalUid?.trim()) return reservation.icalUid.trim();
  return reservation.id.slice(-8).toUpperCase();
}

function resolveInboxStatus(
  reservation: ReservationInboxItem,
): { status: InboxConversationStatus; label: string } {
  if (isInboxConversationUnread(reservation)) {
    return { status: "open", label: "Pendiente" };
  }

  const display = resolveDisplayStatus(reservation.status);
  return { status: "reserved", label: displayStatusLabels[display] };
}

function resolvePaymentAmounts(
  total: number,
  paymentStatus: PaymentStatus,
): { paidAmount: number; dueAmount: number } {
  switch (paymentStatus) {
    case "PAID":
      return { paidAmount: total, dueAmount: 0 };
    case "PARTIAL":
      return { paidAmount: Math.round(total * 0.5), dueAmount: Math.round(total * 0.5) };
    case "REFUNDED":
      return { paidAmount: 0, dueAmount: 0 };
    case "PENDING":
    default:
      return { paidAmount: 0, dueAmount: total };
  }
}

function mapBaseFields(
  reservation: ReservationInboxItem,
  coverImageUrl: string | null,
  extras?: ReservationExtras,
): Omit<InboxConversation, "messages"> {
  const { status, label } = resolveInboxStatus(reservation);
  const total = Number(reservation.totalAmount) || 0;
  const paymentStatus =
    extras?.paymentStatus ?? reservation.paymentStatus ?? "PENDING";
  const { paidAmount, dueAmount } = resolvePaymentAmounts(total, paymentStatus);
  const unitLabel = resolvePropertyUnit({
    name: reservation.property.name,
    unitNumber: reservation.property.unitNumber,
  });
  const unit = unitLabel ? formatPropertyUnitDisplay(unitLabel) : null;
  const activityAt =
    extras?.updatedAt.toISOString() ??
    reservation.updatedAt ??
    reservation.createdAt;
  const imageUrl = coverImageUrl ?? reservation.property.coverImageUrl ?? null;

  return {
    id: reservation.id,
    guestName: reservation.guestName,
    guestInitial: toInitial(reservation.guestName),
    preview: "",
    time: formatPanelDate(activityAt ?? reservation.checkIn),
    dateRange: formatDateRange(
      new Date(`${reservation.checkIn}T12:00:00`),
      new Date(`${reservation.checkOut}T12:00:00`),
    ),
    status,
    statusLabel: label,
    propertyImageUrl: imageUrl,
    bookingCode: resolveBookingCode(reservation),
    platform: reservation.platform,
    propertyName: reservation.property.name,
    propertyUnit: unit ?? "",
    propertyId: reservation.property.id,
    checkIn: formatDate(new Date(`${reservation.checkIn}T12:00:00`)),
    checkOut: formatDate(new Date(`${reservation.checkOut}T12:00:00`)),
    adults: reservation.adults,
    nights: nightsBetween(reservation.checkIn, reservation.checkOut),
    dueAmount,
    paidAmount,
    totalAmount: total,
    currency: reservation.currency,
    lastMessageAt: "",
    guestEmail: reservation.guestEmail ?? "—",
    guestPhone: reservation.guestPhone ?? "—",
    guestLanguage: reservation.guestLanguage ?? reservation.guestCountry ?? "—",
    estimatedArrival: reservation.checkIn,
    estimatedDeparture: reservation.checkOut,
    notes: reservation.internalNotes?.trim() ?? "Sin notas internas.",
    dateSeparator: formatDate(new Date(`${reservation.checkIn}T12:00:00`), {
      month: "long",
      year: "numeric",
    }),
  };
}

/** Lista: mensajes vacíos; el detalle se carga al seleccionar. */
export function mapReservationToConversationSummary(
  reservation: ReservationInboxItem,
  coverImageUrl: string | null,
  extras?: ReservationExtras,
): InboxConversation {
  const messages = buildConversationMessages({
    ...reservation,
    createdAt: reservation.createdAt,
    icalUid: reservation.icalUid ?? extras?.icalUid ?? null,
    relatedBlocks: [],
    guests: [],
  });
  const base = mapBaseFields(reservation, coverImageUrl, extras);
  const last = messages[messages.length - 1];

  return {
    ...base,
    preview: getConversationPreview(messages),
    lastMessageAt: last?.time ?? base.time,
    messages: [],
  };
}

export function mapReservationToConversation(
  reservation: ReservationDetailItem,
  coverImageUrl: string | null,
  extras: ReservationExtras,
): InboxConversation {
  const messages = buildConversationMessages(reservation);
  const base = mapBaseFields(reservation, coverImageUrl, extras);
  const last = messages[messages.length - 1];

  return {
    ...base,
    preview: getConversationPreview(messages),
    lastMessageAt: last?.time ?? base.time,
    messages,
  };
}
