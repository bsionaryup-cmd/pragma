import type { ReservationStatus } from "@prisma/client";

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
  /** Frase legible para el anfitrión. */
  narrative: string;
  guestName: string | null;
  summary: string | null;
  propertyLabel: string | null;
  propertyId: string | null;
  reservationId: string | null;
  reservationStatus: ReservationStatus | null;
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
  guestInitials: string;
  propertyLabel: string | null;
  propertyId: string | null;
  confirmationCode: string | null;
  dateRangeLabel: string | null;
  reservationStatus: ReservationStatus | null;
  statusLabel: string | null;
  latestAt: string;
  latestNarrative: string | null;
  attentionCount: number;
  events: OperationalFeedCard[];
};

export type OperationalFeedView = {
  groups: OperationalFeedReservationGroup[];
  unlinked: OperationalFeedCard[];
};
