import type {
  AirbnbEmailEventKind,
  AirbnbEmailMatchMethod,
  AirbnbEmailSenderChannel,
} from "@prisma/client";
import type { MatchConfidenceTier } from "@/modules/airbnb-email/lib/match-policy";

export type InboundAirbnbEmailPayload = {
  messageId?: string | null;
  from: string;
  to?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  raw?: Record<string, unknown> | null;
  receivedAt?: string | null;
};

export type ClassifiedAirbnbEmail = {
  eventKind: AirbnbEmailEventKind;
  senderChannel: AirbnbEmailSenderChannel;
  anchors: string[];
};

export type ExtractedReservationSignals = {
  confirmationCode?: string | null;
  listingName?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  /** Total guests when email exposes a single count (maps to `adults` if still default). */
  guestCount?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  grossAmount?: number | null;
  hostFee?: number | null;
  netPayout?: number | null;
  currency?: string | null;
  payoutSettlementDate?: string | null;
  payoutAccountId?: string | null;
  messageBody?: string | null;
  rating?: number | null;
  reviewText?: string | null;
  /** Parsed from airbnb.com/rooms/… URLs in HTML (stable metadata). */
  airbnbRoomId?: string | null;
  airbnbRoomIdNumeric?: string | null;
  airbnbRoomSlugs?: string[];
  airbnbListingUrl?: string | null;
  /** Lowercased subject+body+html for slug fragment matching. */
  emailMatchBlob?: string | null;
  /** Internal unit label when explicitly present in email. */
  unitNumber?: string | null;
};

export type ReservationMatchResult = {
  reservationId: string | null;
  propertyId: string | null;
  organizationId: string | null;
  method: AirbnbEmailMatchMethod;
  confidence: number;
  tier: MatchConfidenceTier;
  requiresManualReview: boolean;
  allowReservationEnrichment: boolean;
};

export type ProcessInboundEmailOptions = {
  propertyId?: string | null;
  organizationId?: string | null;
  integrationId?: string | null;
  listingAmbiguous?: boolean;
};

export type EmailProcessingOutcome = {
  auditId: string;
  status:
    | "processed"
    | "skipped_duplicate"
    | "manual_review"
    | "failed"
    | "skipped_disabled"
    | "ignored";
  eventKind?: AirbnbEmailEventKind;
  reservationId?: string | null;
  errorReason?: string | null;
};

export type SafeCommunicationIntent =
  | "EARLY_CHECKIN"
  | "TRANSPORT"
  | "ARRIVAL_SUPPORT"
  | "REVIEW_RESPONSE"
  | "REQUIRES_ATTENTION"
  | null;
