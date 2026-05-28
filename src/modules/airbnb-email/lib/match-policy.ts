import { AirbnbEmailMatchMethod } from "@prisma/client";
import type { ReservationMatchResult } from "@/modules/airbnb-email/types";

export const CONFIDENCE_HIGH_THRESHOLD = 0.9;
export const CONFIDENCE_MEDIUM_THRESHOLD = 0.65;

export type MatchConfidenceTier = "high" | "medium" | "low";

export function confidenceToTier(confidence: number): MatchConfidenceTier {
  if (confidence >= CONFIDENCE_HIGH_THRESHOLD) return "high";
  if (confidence >= CONFIDENCE_MEDIUM_THRESHOLD) return "medium";
  return "low";
}

export function applyMatchPolicy(
  base: Omit<
    ReservationMatchResult,
    "tier" | "allowReservationEnrichment" | "requiresManualReview"
  >,
  options: { hasConfirmationCodeInEmail: boolean },
): ReservationMatchResult {
  const tier = confidenceToTier(base.confidence);

  const listingDatesWithCode =
    base.method === AirbnbEmailMatchMethod.LISTING_DATES &&
    Boolean(options.hasConfirmationCodeInEmail) &&
    (tier === "high" || (tier === "medium" && base.confidence >= 0.82));

  const listingContextualWithCode =
    base.method === AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH &&
    Boolean(options.hasConfirmationCodeInEmail) &&
    (tier === "high" || (tier === "medium" && base.confidence >= 0.84));

  const icalContextualWithCode =
    base.method === AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH &&
    Boolean(options.hasConfirmationCodeInEmail) &&
    (tier === "high" || (tier === "medium" && base.confidence >= 0.84));

  const icalContextualConservative =
    base.method === AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH &&
    tier === "high" &&
    base.confidence >= 0.9;

  const icalContextualPropertyAuto =
    base.method === AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH &&
    base.confidence >= 0.88;

  const propertyScopedAutoLink =
    icalContextualPropertyAuto &&
    Boolean(base.reservationId) &&
    base.confidence >= 0.85;

  const allowReservationEnrichment =
    Boolean(base.reservationId) &&
    (base.method === AirbnbEmailMatchMethod.CONFIRMATION_CODE ||
      listingDatesWithCode ||
      listingContextualWithCode ||
      icalContextualWithCode ||
      icalContextualConservative ||
      icalContextualPropertyAuto);

  const requiresManualReviewResolved =
    !base.reservationId ||
    tier === "low" ||
    (tier === "medium" &&
      base.method !== AirbnbEmailMatchMethod.CONFIRMATION_CODE &&
      !propertyScopedAutoLink);

  return {
    ...base,
    tier,
    requiresManualReview: requiresManualReviewResolved,
    allowReservationEnrichment,
  };
}
