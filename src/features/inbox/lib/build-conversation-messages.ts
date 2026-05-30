import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import type { InboxMessage } from "@/types/inbox";
import { formatDateTime } from "@/lib/helpers/date";
import {
  displayStatusLabels,
  resolveDisplayStatus,
} from "@/features/reservations/lib/reservation-status";

function toInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function buildConversationMessages(
  reservation: ReservationDetailItem,
  hostLabel = "Anfitrión",
): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const displayStatus = resolveDisplayStatus(reservation.status);
  const statusLabel = displayStatusLabels[displayStatus];

  if (reservation.createdAt) {
    messages.push({
      id: `${reservation.id}-confirmed`,
      sender: "host",
      senderName: hostLabel,
      senderInitial: toInitial(hostLabel),
      time: formatDateTime(reservation.createdAt),
      body: `Reserva ${statusLabel.toLowerCase()}. Check-in ${reservation.checkIn}, check-out ${reservation.checkOut}.`,
    });
  }

  if (reservation.guestRegistration?.url) {
    messages.push({
      id: `${reservation.id}-registration`,
      sender: "host",
      senderName: hostLabel,
      senderInitial: toInitial(hostLabel),
      time: formatDateTime(reservation.guestRegistration.createdAt),
      body: "Enlace de registro de huéspedes enviado.",
    });
  }

  if (reservation.guestRegistrationCompletedAt) {
    messages.push({
      id: `${reservation.id}-registration-done`,
      sender: "guest",
      senderName: reservation.guestName,
      senderInitial: toInitial(reservation.guestName),
      time: formatDateTime(reservation.guestRegistrationCompletedAt),
      body: "Registro de huéspedes completado.",
    });
  }

  const notes = reservation.internalNotes?.trim();
  if (notes) {
    messages.push({
      id: `${reservation.id}-notes`,
      sender: "host",
      senderName: hostLabel,
      senderInitial: toInitial(hostLabel),
      time: formatDateTime(reservation.createdAt ?? reservation.checkIn),
      body: notes,
    });
  }

  if (messages.length === 0) {
    messages.push({
      id: `${reservation.id}-empty`,
      sender: "host",
      senderName: hostLabel,
      senderInitial: toInitial(hostLabel),
      time: formatDateTime(reservation.checkIn),
      body: "Sin mensajes del canal aún. La actividad de la reserva aparecerá aquí.",
    });
  }

  return messages;
}

export function getConversationPreview(messages: InboxMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last?.body) return "Sin mensajes";
  const compact = last.body.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}…` : compact;
}
