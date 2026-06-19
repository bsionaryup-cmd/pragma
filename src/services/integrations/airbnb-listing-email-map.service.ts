import { PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { parseAirbnbRoomId } from "@/services/airbnb/airbnb-import.service";
import {
  normalizeAirbnbListingForMatch,
  pickUniquePropertyByListingName,
} from "@/services/integrations/airbnb-property-metadata-resolver.service";

function normalizeListingName(name: string): string {
  return normalizeAirbnbListingForMatch(name);
}

export async function syncListingEmailMapsForOrganization(
  organizationId: string,
): Promise<number> {
  const properties = await db.property.findMany({
    where: {
      organizationId,
      status: PropertyStatus.ACTIVE,
      OR: [{ icalUrl: { not: null } }, { airbnbListingUrl: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      airbnbRoomId: true,
      airbnbListingUrl: true,
    },
  });

  let upserted = 0;
  for (const property of properties) {
    const roomId =
      property.airbnbRoomId?.trim() ||
      (property.airbnbListingUrl
        ? parseAirbnbRoomId(property.airbnbListingUrl)
        : null);
    await db.airbnbListingEmailMap.upsert({
      where: {
        organizationId_propertyId: {
          organizationId,
          propertyId: property.id,
        },
      },
      create: {
        organizationId,
        propertyId: property.id,
        airbnbRoomId: roomId,
        listingName: property.name,
        listingNameNorm: normalizeListingName(property.name),
      },
      update: {
        airbnbRoomId: roomId,
        listingName: property.name,
        listingNameNorm: normalizeListingName(property.name),
      },
    });
    upserted += 1;
  }

  return upserted;
}

export type ListingMapResolution =
  | { propertyId: string; ambiguous: false }
  | { propertyId: null; ambiguous: true }
  | null;

export async function resolvePropertyFromListingMap(input: {
  organizationId: string;
  listingName?: string | null;
  airbnbRoomId?: string | null;
}): Promise<ListingMapResolution> {
  if (input.airbnbRoomId?.trim()) {
    const byRoom = await db.airbnbListingEmailMap.findMany({
      where: {
        organizationId: input.organizationId,
        airbnbRoomId: input.airbnbRoomId.trim(),
      },
      select: { propertyId: true },
    });
    if (byRoom.length === 1) {
      return { propertyId: byRoom[0]!.propertyId, ambiguous: false };
    }
    if (byRoom.length > 1) {
      return { propertyId: null, ambiguous: true };
    }
  }

  const name = input.listingName?.trim();
  if (!name || name.length < 4) return null;

  const norm = normalizeListingName(name);
  const maps = await db.airbnbListingEmailMap.findMany({
    where: { organizationId: input.organizationId },
    select: { propertyId: true, listingName: true, listingNameNorm: true },
  });

  const exact = maps.filter(
    (m) =>
      normalizeListingName(m.listingName) === norm ||
      normalizeListingName(m.listingNameNorm) === norm,
  );
  if (exact.length === 1) {
    return { propertyId: exact[0]!.propertyId, ambiguous: false };
  }
  if (exact.length > 1) {
    return { propertyId: null, ambiguous: true };
  }

  const picked = pickUniquePropertyByListingName({
    listingName: name,
    properties: maps.map((m) => ({
      propertyId: m.propertyId,
      name: m.listingName,
    })),
  });
  if (picked.propertyId) {
    return { propertyId: picked.propertyId, ambiguous: false };
  }
  if (picked.ambiguous) {
    return { propertyId: null, ambiguous: true };
  }

  return null;
}
