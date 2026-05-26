import { resolvePropertyFromListingMap } from "@/services/integrations/airbnb-listing-email-map.service";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type PropertyResolutionResult = {
  propertyId: string | null;
  ambiguous: boolean;
};

export async function resolvePropertyIdFromEmailSignals(
  organizationId: string,
  signals: ExtractedReservationSignals,
  explicitPropertyId?: string | null,
): Promise<PropertyResolutionResult> {
  if (explicitPropertyId) {
    return { propertyId: explicitPropertyId, ambiguous: false };
  }

  const mapped = await resolvePropertyFromListingMap({
    organizationId,
    listingName: signals.listingName,
    airbnbRoomId: null,
  });

  if (mapped?.ambiguous) {
    return { propertyId: null, ambiguous: true };
  }

  if (mapped?.propertyId) {
    return { propertyId: mapped.propertyId, ambiguous: false };
  }

  return { propertyId: null, ambiguous: false };
}
