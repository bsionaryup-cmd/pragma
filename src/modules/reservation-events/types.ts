import type { ReservationEventType } from "@prisma/client";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type ModificationObservabilityKind = Extract<
  ReservationEventType,
  "MODIFICATION_REQUEST" | "MODIFICATION_APPROVED"
>;

export type ModificationEventMetadata = {
  guestName?: string | null;
  propertyLabel?: string | null;
  originalDates?: {
    checkIn?: string | null;
    checkOut?: string | null;
    raw?: string | null;
  } | null;
  requestedDates?: {
    checkIn?: string | null;
    checkOut?: string | null;
    raw?: string | null;
  } | null;
  subject?: string | null;
  confirmationCode?: string | null;
};

export type RecordModificationFromEmailInput = {
  organizationId: string | null;
  auditId: string;
  reservationId?: string | null;
  propertyId?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  signals?: ExtractedReservationSignals;
};
