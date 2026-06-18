import type { BookingPlatform, ReservationStatus } from "@prisma/client";
import type { OperationalFeedPriority } from "@/services/novedades/operational-feed.types";

export type NovedadesTimelineKind =
  | "RESERVATION_CREATED"
  | "NEW_RESERVATION"
  | "MODIFICATION_REQUEST"
  | "MODIFICATION_APPROVED"
  | "RESERVATION_UPDATED"
  | "STAY_EXTENDED"
  | "RESERVATION_CANCELLED"
  | "GUEST_MESSAGE"
  | "PAYMENT_CONFIRMED"
  | "PAYOUT_SENT"
  | "GUEST_REGISTRATION"
  | "ACCESS_CODE"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "TASK"
  | "ALERT";

export type NovedadesTimelineEntry = {
  id: string;
  kind: NovedadesTimelineKind;
  title: string;
  narrative: string;
  priority: OperationalFeedPriority;
  createdAt: string;
  timeLabel: string;
  /** Texto limpio del huésped (solo mensajes). */
  messageBody?: string | null;
  /** Monto legible en pagos, desembolsos o reserva. */
  amountLabel?: string | null;
  suggestedReplies?: NovedadesSuggestedAction[];
};

export type NovedadesSuggestedAction = {
  id: string;
  label: string;
  messageText: string;
  variant: "primary" | "secondary";
  hint?: string;
};

export type NovedadesStayStageLabel =
  | "Nueva reserva"
  | "Pre-llegada"
  | "Día de check-in"
  | "En estadía"
  | "Día de salida"
  | "Finalizada"
  | "Cancelada";

export type NovedadesInboxListItem = {
  reservationId: string;
  guestName: string;
  guestInitials: string;
  propertyLabel: string;
  dateRangeLabel: string | null;
  confirmationCode: string | null;
  reservationStatus: ReservationStatus | null;
  statusLabel: string | null;
  platform: BookingPlatform | null;
  latestAt: string;
  latestTimeLabel: string;
  latestNarrative: string;
  latestKind: NovedadesTimelineKind | null;
  /** Etiqueta de intención IA (solo si el último evento es mensaje del huésped). */
  latestIntentLabel?: string | null;
  amountLabel: string | null;
  attentionCount: number;
  eventCount: number;
};

export type NovedadesReservationDetail = {
  reservationId: string;
  guestName: string;
  guestInitials: string;
  propertyLabel: string;
  propertyId: string;
  dateRangeLabel: string;
  confirmationCode: string | null;
  reservationStatus: ReservationStatus;
  statusLabel: string;
  platform: BookingPlatform;
  checkIn: string;
  checkOut: string;
  totalAmountLabel: string | null;
  entries: NovedadesTimelineEntry[];
  stayStage: NovedadesStayStageLabel;
  /** Los 7 mensajes predeterminados listos para copiar. */
  copyMessageActions: NovedadesSuggestedAction[];
};

export type NovedadesInboxSnapshot = {
  items: NovedadesInboxListItem[];
  latestAt: string | null;
};
