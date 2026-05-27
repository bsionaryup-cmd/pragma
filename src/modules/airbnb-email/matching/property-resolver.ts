import { resolvePropertyFromKnownMetadata } from "@/services/integrations/airbnb-property-metadata-resolver.service";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type PropertyResolutionResult = {
  propertyId: string | null;
  ambiguous: boolean;
  resolutionMethod?: string;
};

function parseDateKey(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function resolvePropertyIdFromEmailSignals(
  organizationId: string,
  signals: ExtractedReservationSignals,
  explicitPropertyId?: string | null,
): Promise<PropertyResolutionResult> {
  const resolved = await resolvePropertyFromKnownMetadata({
    organizationId,
    explicitPropertyId,
    airbnbRoomId: signals.airbnbRoomId,
    unitNumber: signals.unitNumber,
    listingName: signals.listingName,
    guestName: signals.guestName,
    parsedCheckIn: parseDateKey(signals.checkIn),
    parsedCheckOut: parseDateKey(signals.checkOut),
  });

  return {
    propertyId: resolved.propertyId,
    ambiguous: resolved.ambiguous,
    resolutionMethod: resolved.method,
  };
}
