import { AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";

/**
 * Backward-compatible persistence for deployments where DB enum lags app enum.
 */
export function toPersistedMatchMethod(
  method: AirbnbEmailMatchMethod,
): AirbnbEmailMatchMethod {
  if (
    method === AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH ||
    method === AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH
  ) {
    airbnbEmailLog.warn("match_method_persistence_fallback", {
      from: method,
      to: AirbnbEmailMatchMethod.LISTING_DATES,
      reason: "db_enum_compatibility",
    });
    return AirbnbEmailMatchMethod.LISTING_DATES;
  }
  return method;
}
