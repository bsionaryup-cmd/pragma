import { resolvePropertyFromKnownMetadata } from "@/services/integrations/airbnb-property-metadata-resolver.service";
import { normalizeAirbnbListingForMatch } from "@/services/integrations/airbnb-property-metadata-resolver.service";
import { db } from "@/lib/db";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type PropertyResolutionResult = {
  propertyId: string | null;
  ambiguous: boolean;
  resolutionMethod?: string;
  normalizedListing?: string | null;
  resolvedPropertyName?: string | null;
  propertyMatchConfidence?: number;
  candidateProperties?: string[];
};

function confidenceByMethod(method: string | undefined): number {
  if (!method || method === "none") return 0;
  if (method === "explicit") return 1;
  if (method === "normalized_property_name") return 0.97;
  if (method === "airbnb_room_id_property" || method === "airbnb_room_id_listing_map") {
    return 0.96;
  }
  if (method === "unit_number") return 0.94;
  if (method === "reservation_guest_context") return 0.9;
  if (method === "listing_name_text" || method === "airbnb_slug_email_fragment") return 0.86;
  return 0.75;
}

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
  const normalizedListing = signals.listingName?.trim()
    ? normalizeAirbnbListingForMatch(signals.listingName)
    : null;

  const resolved = await resolvePropertyFromKnownMetadata({
    organizationId,
    explicitPropertyId,
    airbnbRoomId: signals.airbnbRoomId,
    airbnbRoomIdNumeric: signals.airbnbRoomIdNumeric,
    airbnbRoomSlugs: signals.airbnbRoomSlugs,
    emailMatchBlob: signals.emailMatchBlob,
    unitNumber: signals.unitNumber,
    listingName: signals.listingName,
    guestName: signals.guestName,
    parsedCheckIn: parseDateKey(signals.checkIn),
    parsedCheckOut: parseDateKey(signals.checkOut),
  });

  const resolvedProperty = resolved.propertyId
    ? await db.property.findUnique({
        where: { id: resolved.propertyId },
        select: { name: true },
      })
    : null;

  const candidateProperties =
    !resolved.propertyId && organizationId
      ? (
          await db.property.findMany({
            where: { organizationId },
            select: { id: true, name: true, unitNumber: true },
            orderBy: { name: "asc" },
            take: 25,
          })
        ).map((p) => `${p.id}:${p.name}${p.unitNumber ? `#${p.unitNumber}` : ""}`)
      : [];

  return {
    propertyId: resolved.propertyId,
    ambiguous: resolved.ambiguous,
    resolutionMethod: resolved.method,
    normalizedListing,
    resolvedPropertyName: resolvedProperty?.name ?? null,
    propertyMatchConfidence: confidenceByMethod(resolved.method),
    candidateProperties,
  };
}
