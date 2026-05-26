import { PropertyStatus } from "@prisma/client";
import { db } from "@/lib/db";

function normalizeListingName(name: string): string {
  return name.trim().toLowerCase();
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
    },
  });

  let upserted = 0;
  for (const property of properties) {
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
        airbnbRoomId: property.airbnbRoomId,
        listingName: property.name,
        listingNameNorm: normalizeListingName(property.name),
      },
      update: {
        airbnbRoomId: property.airbnbRoomId,
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
  const matches = await db.airbnbListingEmailMap.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        { listingNameNorm: norm },
        { listingNameNorm: { contains: norm.slice(0, 24) } },
      ],
    },
    select: { propertyId: true, listingNameNorm: true },
  });

  const exact = matches.filter((m) => m.listingNameNorm === norm);
  if (exact.length === 1) {
    return { propertyId: exact[0]!.propertyId, ambiguous: false };
  }
  if (exact.length > 1 || matches.length > 1) {
    return { propertyId: null, ambiguous: true };
  }
  if (matches.length === 1) {
    return { propertyId: matches[0]!.propertyId, ambiguous: false };
  }

  return null;
}
