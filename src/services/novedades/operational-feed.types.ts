export type OperationalFeedKind =
  | "GUEST_MESSAGE"
  | "MODIFICATION_REQUEST"
  | "MODIFICATION_APPROVED"
  | "RESERVATION_UPDATED"
  | "STAY_EXTENDED"
  | "PAYOUT_SENT"
  | "NEW_RESERVATION"
  | "RESERVATION_CANCELLED"
  | "PAYMENT_CONFIRMED"
  | "ALERT";

export type OperationalFeedPriority = "normal" | "attention";

export type OperationalFeedCard = {
  id: string;
  kind: OperationalFeedKind;
  priority: OperationalFeedPriority;
  emoji: string;
  headline: string;
  guestName: string | null;
  summary: string | null;
  propertyLabel: string | null;
  propertyId: string | null;
  reservationId: string | null;
  confirmationCode: string | null;
  amountLabel: string | null;
  dateRangeLabel: string | null;
  detailLines: string[];
  relativeTime: string;
  createdAt: string;
};

export type OperationalFeedReservationGroup = {
  reservationId: string;
  guestName: string | null;
  propertyLabel: string | null;
  propertyId: string | null;
  confirmationCode: string | null;
  dateRangeLabel: string | null;
  latestAt: string;
  attentionCount: number;
  events: OperationalFeedCard[];
};

export type OperationalFeedView = {
  groups: OperationalFeedReservationGroup[];
  /** Eventos sin reserva vinculada (p. ej. desembolsos huérfanos). */
  unlinked: OperationalFeedCard[];
};
