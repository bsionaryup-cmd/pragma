export type OperationalFeedKind =
  | "GUEST_MESSAGE"
  | "MODIFICATION_REQUEST"
  | "MODIFICATION_APPROVED"
  | "PAYOUT_SENT"
  | "NEW_RESERVATION"
  | "UPCOMING_CHECKIN"
  | "UPCOMING_CHECKOUT"
  | "RESERVATION_CANCELLED"
  | "GUEST_REGISTRATION_ADMIN_SENT"
  | "GUEST_REGISTRATION_ADMIN_FAILED";

export type OperationalFeedCard = {
  id: string;
  kind: OperationalFeedKind;
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
  quickActionLabel?: string | null;
  quickActionMessage?: string | null;
  relativeTime: string;
  createdAt: string;
};
