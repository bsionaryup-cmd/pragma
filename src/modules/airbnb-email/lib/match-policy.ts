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

  const requiresManualReview =
    !base.reservationId ||
    tier === "low" ||
    (tier === "medium" && base.method !== AirbnbEmailMatchMethod.CONFIRMATION_CODE);

  const listingDatesWithCode =
    base.method === AirbnbEmailMatchMethod.LISTING_DATES &&
    Boolean(options.hasConfirmationCodeInEmail) &&
    (tier === "high" || (tier === "medium" && base.confidence >= 0.82));

  const listingContextualWithCode =
    base.method === AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH &&
    Boolean(options.hasConfirmationCodeInEmail) &&
    (tier === "high" || (tier === "medium" && base.confidence >= 0.84));

  const allowReservationEnrichment =
    Boolean(base.reservationId) &&
    (base.method === AirbnbEmailMatchMethod.CONFIRMATION_CODE ||
      listingDatesWithCode ||
      listingContextualWithCode);

  return {
    ...base,
    tier,
    requiresManualReview,
    allowReservationEnrichment,
  };
}
