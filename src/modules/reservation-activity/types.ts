import type { AirbnbEmailEventKind, ReservationActivityType } from "@prisma/client";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type RecordActivityFromEmailInput = {
  organizationId: string | null;
  auditId: string;
  reservationId?: string | null;
  propertyId?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  from?: string | null;
  signals?: ExtractedReservationSignals;
  pipelineEventKind?: AirbnbEmailEventKind | null;
  receivedAt?: string | null;
};

export type ActivityClassificationResult = {
  activityType: ReservationActivityType;
  confidence: number;
};

export type ActivityMetadata = {
  guestName?: string | null;
  propertyLabel?: string | null;
  originalDates?: { raw?: string | null } | null;
  requestedDates?: { raw?: string | null } | null;
  subject?: string | null;
  confirmationCode?: string | null;
  classificationConfidence?: number | null;
  pipelineEventKind?: string | null;
  /** Cuerpo crudo del correo para parseo en lectura (Novedades). */
  rawMessageBody?: string | null;
};
