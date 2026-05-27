import {
  BookingPlatform,
  PropertyStatus,
  ReservationStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { resolvePropertyFromListingMap } from "@/services/integrations/airbnb-listing-email-map.service";

export type PropertyMetadataResolutionMethod =
  | "explicit"
  | "normalized_property_name"
  | "airbnb_room_id_property"
  | "airbnb_room_id_listing_map"
  | "airbnb_slug_email_fragment"
  | "unit_number"
  | "reservation_guest_context"
  | "listing_name_text"
  | "none";

function logPropertyMappingFound(input: {
  organizationId: string;
  propertyId: string | null;
  method: PropertyMetadataResolutionMethod;
  airbnbRoomId?: string | null;
  unitNumber?: string | null;
  note?: string;
}) {
  airbnbEmailLog.info("property_mapping_found", {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    method: input.method,
    airbnbRoomId: input.airbnbRoomId ?? undefined,
    unitNumber: input.unitNumber ?? undefined,
    note: input.note,
  });
  airbnbEmailLog.info("property_mapping_resolved", {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    method: input.method,
    airbnbRoomId: input.airbnbRoomId ?? undefined,
  });
}

export type PropertyMetadataResolution = {
  propertyId: string | null;
  ambiguous: boolean;
  method: PropertyMetadataResolutionMethod;
  airbnbRoomId?: string | null;
  unitNumber?: string | null;
};

type PropertyNameCandidate = {
  propertyId: string;
  name: string;
};

export function normalizeAirbnbListingForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;/g, " ")
    .replace(/[|•]/g, " ")
    .replace(/[^a-z0-9áéíóúñü\s-]/gi, " ")
    .replace(/\b(?:codigo|c[oó]digo|confirmation|confirmaci[oó]n|check-?in|check-?out|llega|arrives)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingUnitSuffix(normName: string): string {
  return normName.replace(/\s*-\s*[a-z0-9]{1,8}$/i, "").trim();
}

export function pickUniquePropertyByListingName(input: {
  listingName: string;
  properties: PropertyNameCandidate[];
}): { propertyId: string | null; ambiguous: boolean } {
  const normListing = normalizeAirbnbListingForMatch(input.listingName);
  if (normListing.length < 8) return { propertyId: null, ambiguous: false };

  const scored = input.properties
    .map((property) => {
      const normProperty = normalizeAirbnbListingForMatch(property.name);
      const baseProperty = stripTrailingUnitSuffix(normProperty);
      let score = 0;

      if (normProperty === normListing || baseProperty === normListing) score = 100;
      else if (
        normProperty.startsWith(normListing) ||
        baseProperty.startsWith(normListing)
      ) {
        score = 90;
      } else if (
        normListing.startsWith(baseProperty) &&
        baseProperty.length >= 12
      ) {
        score = 85;
      } else if (
        (normProperty.includes(normListing) || baseProperty.includes(normListing)) &&
        normListing.length >= 16
      ) {
        score = 70;
      }

      return { propertyId: property.propertyId, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { propertyId: null, ambiguous: false };
  if (scored.length === 1) return { propertyId: scored[0]!.propertyId, ambiguous: false };

  const first = scored[0]!;
  const second = scored[1]!;
  if (first.score - second.score >= 15) {
    return { propertyId: first.propertyId, ambiguous: false };
  }

  return { propertyId: null, ambiguous: true };
}

async function resolveByNormalizedPropertyName(input: {
  organizationId: string;
  listingName: string;
}): Promise<PropertyMetadataResolution | null> {
  const properties = await db.property.findMany({
    where: {
      organizationId: input.organizationId,
      status: PropertyStatus.ACTIVE,
      OR: [
        { airbnbListingUrl: { not: null } },
        { airbnbRoomId: { not: null } },
        { icalUrl: { not: null } },
      ],
    },
    select: { id: true, name: true },
  });

  const picked = pickUniquePropertyByListingName({
    listingName: input.listingName,
    properties: properties.map((p) => ({ propertyId: p.id, name: p.name })),
  });
  if (picked.propertyId) {
    return {
      propertyId: picked.propertyId,
      ambiguous: false,
      method: "normalized_property_name",
    };
  }
  if (picked.ambiguous) {
    return {
      propertyId: null,
      ambiguous: true,
      method: "normalized_property_name",
    };
  }
  return null;
}

async function resolveByAirbnbRoomIdOnProperty(input: {
  organizationId: string;
  airbnbRoomId: string;
}): Promise<PropertyMetadataResolution | null> {
  const rows = await db.property.findMany({
    where: {
      organizationId: input.organizationId,
      status: PropertyStatus.ACTIVE,
      airbnbRoomId: input.airbnbRoomId,
    },
    select: { id: true },
  });

  if (rows.length === 1) {
    return {
      propertyId: rows[0]!.id,
      ambiguous: false,
      method: "airbnb_room_id_property",
      airbnbRoomId: input.airbnbRoomId,
    };
  }
  if (rows.length > 1) {
    return {
      propertyId: null,
      ambiguous: true,
      method: "airbnb_room_id_property",
      airbnbRoomId: input.airbnbRoomId,
    };
  }
  return null;
}

async function resolveByUnitNumber(input: {
  organizationId: string;
  unitNumber: string;
}): Promise<PropertyMetadataResolution | null> {
  const norm = input.unitNumber.trim().toLowerCase();
  const rows = await db.property.findMany({
    where: {
      organizationId: input.organizationId,
      status: PropertyStatus.ACTIVE,
      unitNumber: { not: null },
    },
    select: { id: true, unitNumber: true },
  });

  const matches = rows.filter(
    (r) => r.unitNumber?.trim().toLowerCase() === norm,
  );
  if (matches.length === 1) {
    return {
      propertyId: matches[0]!.id,
      ambiguous: false,
      method: "unit_number",
      unitNumber: input.unitNumber,
    };
  }
  if (matches.length > 1) {
    return {
      propertyId: null,
      ambiguous: true,
      method: "unit_number",
      unitNumber: input.unitNumber,
    };
  }
  return null;
}

async function resolveByReservationGuestContext(input: {
  organizationId: string;
  guestName: string | null | undefined;
  parsedCheckIn: Date | null;
  parsedCheckOut: Date | null;
}): Promise<PropertyMetadataResolution | null> {
  const guestQuery = input.guestName?.trim();
  if (!guestQuery || guestQuery.length < 3) return null;

  const tokens = guestQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const primaryToken = tokens[0] ?? guestQuery.toLowerCase();
  if (!primaryToken || primaryToken.length < 2) return null;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 180);

  const hasDates = Boolean(input.parsedCheckIn && input.parsedCheckOut);

  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      guestName: { contains: primaryToken, mode: "insensitive" },
      property: {
        organizationId: input.organizationId,
        status: PropertyStatus.ACTIVE,
      },
      checkIn: hasDates
        ? { lt: input.parsedCheckOut! }
        : { lte: windowEnd },
      checkOut: hasDates
        ? { gt: input.parsedCheckIn! }
        : { gte: windowStart },
    }),
    select: { propertyId: true, guestName: true },
  });

  const narrowed =
    tokens.length > 1
      ? reservations.filter((r) => {
          const gn = r.guestName.toLowerCase();
          return tokens.every((t) => gn.includes(t));
        })
      : reservations;

  const propertyIds = [...new Set(narrowed.map((r) => r.propertyId))];
  if (propertyIds.length === 1) {
    return {
      propertyId: propertyIds[0]!,
      ambiguous: false,
      method: "reservation_guest_context",
    };
  }
  if (propertyIds.length > 1) {
    return {
      propertyId: null,
      ambiguous: true,
      method: "reservation_guest_context",
    };
  }
  return null;
}

async function resolveByUniqueSlugInEmailBlob(input: {
  organizationId: string;
  emailMatchBlob: string;
  slugs: string[];
}): Promise<PropertyMetadataResolution | null> {
  const blob = input.emailMatchBlob.toLowerCase();
  if (!blob.trim()) return null;

  const properties = await db.property.findMany({
    where: {
      organizationId: input.organizationId,
      status: PropertyStatus.ACTIVE,
      airbnbRoomId: { not: null },
    },
    select: { id: true, airbnbRoomId: true },
  });

  const matched = properties.filter((property) => {
    const slug = property.airbnbRoomId?.trim().toLowerCase();
    if (!slug || slug.length < 3) return false;
    if (input.slugs.includes(slug)) return true;
    return (
      blob.includes(slug) ||
      blob.includes(`/h/${slug}`) ||
      blob.includes(`h/${slug}`)
    );
  });

  if (matched.length === 1) {
    return {
      propertyId: matched[0]!.id,
      ambiguous: false,
      method: "airbnb_slug_email_fragment",
      airbnbRoomId: matched[0]!.airbnbRoomId,
    };
  }
  if (matched.length > 1) {
    return {
      propertyId: null,
      ambiguous: true,
      method: "airbnb_slug_email_fragment",
    };
  }
  return null;
}

async function resolveRoomIdToProperty(input: {
  organizationId: string;
  roomId: string;
}): Promise<PropertyMetadataResolution | null> {
  const onProperty = await resolveByAirbnbRoomIdOnProperty({
    organizationId: input.organizationId,
    airbnbRoomId: input.roomId,
  });
  if (onProperty) return onProperty;

  const fromMap = await resolvePropertyFromListingMap({
    organizationId: input.organizationId,
    airbnbRoomId: input.roomId,
    listingName: null,
  });
  if (fromMap && !fromMap.ambiguous && fromMap.propertyId) {
    return {
      propertyId: fromMap.propertyId,
      ambiguous: false,
      method: "airbnb_room_id_listing_map",
      airbnbRoomId: input.roomId,
    };
  }
  if (fromMap?.ambiguous) {
    return {
      propertyId: null,
      ambiguous: true,
      method: "airbnb_room_id_listing_map",
      airbnbRoomId: input.roomId,
    };
  }
  return null;
}

export async function resolvePropertyFromKnownMetadata(input: {
  organizationId: string;
  explicitPropertyId?: string | null;
  airbnbRoomId?: string | null;
  airbnbRoomIdNumeric?: string | null;
  airbnbRoomSlugs?: string[];
  emailMatchBlob?: string | null;
  unitNumber?: string | null;
  listingName?: string | null;
  guestName?: string | null;
  parsedCheckIn?: Date | null;
  parsedCheckOut?: Date | null;
}): Promise<PropertyMetadataResolution> {
  if (input.explicitPropertyId) {
    logPropertyMappingFound({
      organizationId: input.organizationId,
      propertyId: input.explicitPropertyId,
      method: "explicit",
    });
    return {
      propertyId: input.explicitPropertyId,
      ambiguous: false,
      method: "explicit",
    };
  }

  const listingName = input.listingName?.trim();
  if (listingName && listingName.length >= 8) {
    const byNormalizedName = await resolveByNormalizedPropertyName({
      organizationId: input.organizationId,
      listingName,
    });
    if (byNormalizedName?.propertyId) {
      logPropertyMappingFound({
        organizationId: input.organizationId,
        propertyId: byNormalizedName.propertyId,
        method: "normalized_property_name",
        note: "normalized_listing_to_property_name",
      });
      return byNormalizedName;
    }
    if (byNormalizedName?.ambiguous) {
      airbnbEmailLog.warn("property_mapping_failed", {
        organizationId: input.organizationId,
        reason: "ambiguous_normalized_property_name",
      });
      return byNormalizedName;
    }
  }

  const slugCandidates = [
    ...(input.airbnbRoomSlugs ?? []),
    ...(input.airbnbRoomId?.trim() && !/^\d+$/.test(input.airbnbRoomId.trim())
      ? [input.airbnbRoomId.trim().toLowerCase()]
      : []),
  ];
  const uniqueSlugs = [...new Set(slugCandidates.filter(Boolean))];

  const numericId = input.airbnbRoomIdNumeric?.trim() ?? null;
  const primaryRoomId = input.airbnbRoomId?.trim() ?? null;

  if (primaryRoomId || numericId || uniqueSlugs.length) {
    airbnbEmailLog.info("listing_id_detected", {
      organizationId: input.organizationId,
      airbnbRoomId: primaryRoomId ?? undefined,
      airbnbRoomIdNumeric: numericId ?? undefined,
      slugCount: uniqueSlugs.length,
    });
  }

  for (const slug of uniqueSlugs) {
    const resolved = await resolveRoomIdToProperty({
      organizationId: input.organizationId,
      roomId: slug,
    });
    if (resolved) {
      if (resolved.propertyId) {
        logPropertyMappingFound({
          organizationId: input.organizationId,
          propertyId: resolved.propertyId,
          method: resolved.method,
          airbnbRoomId: slug,
        });
      } else if (resolved.ambiguous) {
        airbnbEmailLog.warn("property_mapping_failed", {
          organizationId: input.organizationId,
          reason: "ambiguous_room_slug",
          airbnbRoomId: slug,
        });
      }
      return resolved;
    }
  }

  if (primaryRoomId && /^\d+$/.test(primaryRoomId)) {
    const resolved = await resolveRoomIdToProperty({
      organizationId: input.organizationId,
      roomId: primaryRoomId,
    });
    if (resolved) {
      if (resolved.propertyId) {
        logPropertyMappingFound({
          organizationId: input.organizationId,
          propertyId: resolved.propertyId,
          method: resolved.method,
          airbnbRoomId: primaryRoomId,
        });
      } else if (resolved.ambiguous) {
        airbnbEmailLog.warn("property_mapping_failed", {
          organizationId: input.organizationId,
          reason: "ambiguous_room_id_numeric",
          airbnbRoomId: primaryRoomId,
        });
      }
      return resolved;
    }
  }

  if (numericId && numericId !== primaryRoomId) {
    const resolved = await resolveRoomIdToProperty({
      organizationId: input.organizationId,
      roomId: numericId,
    });
    if (resolved) {
      if (resolved.propertyId) {
        logPropertyMappingFound({
          organizationId: input.organizationId,
          propertyId: resolved.propertyId,
          method: resolved.method,
          airbnbRoomId: numericId,
        });
      } else if (resolved.ambiguous) {
        airbnbEmailLog.warn("property_mapping_failed", {
          organizationId: input.organizationId,
          reason: "ambiguous_room_id_numeric",
          airbnbRoomId: numericId,
        });
      }
      return resolved;
    }
  }

  if (input.emailMatchBlob?.trim()) {
    const byFragment = await resolveByUniqueSlugInEmailBlob({
      organizationId: input.organizationId,
      emailMatchBlob: input.emailMatchBlob,
      slugs: uniqueSlugs,
    });
    if (byFragment) {
      if (byFragment.propertyId) {
        logPropertyMappingFound({
          organizationId: input.organizationId,
          propertyId: byFragment.propertyId,
          method: byFragment.method,
          airbnbRoomId: byFragment.airbnbRoomId,
          note: "slug_fragment_in_email",
        });
      } else if (byFragment.ambiguous) {
        airbnbEmailLog.warn("property_mapping_failed", {
          organizationId: input.organizationId,
          reason: "ambiguous_slug_email_fragment",
        });
      }
      return byFragment;
    }
  }

  const unit = input.unitNumber?.trim();
  if (unit) {
    const byUnit = await resolveByUnitNumber({
      organizationId: input.organizationId,
      unitNumber: unit,
    });
    if (byUnit) {
      if (byUnit.propertyId) {
        logPropertyMappingFound({
          organizationId: input.organizationId,
          propertyId: byUnit.propertyId,
          method: byUnit.method,
          unitNumber: unit,
        });
      } else {
        airbnbEmailLog.warn("property_mapping_failed", {
          organizationId: input.organizationId,
          reason: "ambiguous_unit_number",
          unitNumber: unit,
        });
      }
      return byUnit;
    }
  }

  const byGuest = await resolveByReservationGuestContext({
    organizationId: input.organizationId,
    guestName: input.guestName,
    parsedCheckIn: input.parsedCheckIn ?? null,
    parsedCheckOut: input.parsedCheckOut ?? null,
  });
  if (byGuest) {
    if (byGuest.propertyId) {
      logPropertyMappingFound({
        organizationId: input.organizationId,
        propertyId: byGuest.propertyId,
        method: byGuest.method,
        note: "reservation_guest_context",
      });
    } else {
      airbnbEmailLog.warn("property_mapping_failed", {
        organizationId: input.organizationId,
        reason: "ambiguous_reservation_guest_context",
        guestNameSignal: Boolean(input.guestName),
      });
    }
    return byGuest;
  }

  if (listingName && listingName.length >= 4) {
    const fromName = await resolvePropertyFromListingMap({
      organizationId: input.organizationId,
      listingName,
      airbnbRoomId: null,
    });
    if (fromName && !fromName.ambiguous && fromName.propertyId) {
      logPropertyMappingFound({
        organizationId: input.organizationId,
        propertyId: fromName.propertyId,
        method: "listing_name_text",
        note: "fragile_text_fallback",
      });
      return {
        propertyId: fromName.propertyId,
        ambiguous: false,
        method: "listing_name_text",
      };
    }
    if (fromName?.ambiguous) {
      airbnbEmailLog.warn("property_mapping_failed", {
        organizationId: input.organizationId,
        reason: "ambiguous_listing_name_text",
      });
      return {
        propertyId: null,
        ambiguous: true,
        method: "listing_name_text",
      };
    }
  }

  airbnbEmailLog.warn("property_mapping_failed", {
    organizationId: input.organizationId,
    reason: "no_metadata_match",
    hadRoomId: Boolean(primaryRoomId || numericId),
    hadSlugs: uniqueSlugs.length > 0,
    hadUnit: Boolean(unit),
    hadGuestName: Boolean(input.guestName),
    hadListingName: Boolean(listingName),
  });

  return { propertyId: null, ambiguous: false, method: "none" };
}
