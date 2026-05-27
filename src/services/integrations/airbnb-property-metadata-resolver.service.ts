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
  | "airbnb_room_id_property"
  | "airbnb_room_id_listing_map"
  | "unit_number"
  | "reservation_guest_context"
  | "listing_name_text"
  | "none";

export type PropertyMetadataResolution = {
  propertyId: string | null;
  ambiguous: boolean;
  method: PropertyMetadataResolutionMethod;
  airbnbRoomId?: string | null;
  unitNumber?: string | null;
};

function guestFirstToken(guestName: string | null | undefined): string | null {
  if (!guestName?.trim()) return null;
  const token = guestName.trim().split(/\s+/)[0]?.toLowerCase();
  if (!token || token.length < 2) return null;
  return token;
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
  const token = guestFirstToken(input.guestName);
  if (!token) return null;

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
      guestName: { contains: token, mode: "insensitive" },
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
    select: { propertyId: true },
  });

  const propertyIds = [...new Set(reservations.map((r) => r.propertyId))];
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

export async function resolvePropertyFromKnownMetadata(input: {
  organizationId: string;
  explicitPropertyId?: string | null;
  airbnbRoomId?: string | null;
  unitNumber?: string | null;
  listingName?: string | null;
  guestName?: string | null;
  parsedCheckIn?: Date | null;
  parsedCheckOut?: Date | null;
}): Promise<PropertyMetadataResolution> {
  if (input.explicitPropertyId) {
    return {
      propertyId: input.explicitPropertyId,
      ambiguous: false,
      method: "explicit",
    };
  }

  const roomId = input.airbnbRoomId?.trim();
  if (roomId) {
    airbnbEmailLog.info("listing_id_detected", {
      organizationId: input.organizationId,
      airbnbRoomId: roomId,
    });

    const onProperty = await resolveByAirbnbRoomIdOnProperty({
      organizationId: input.organizationId,
      airbnbRoomId: roomId,
    });
    if (onProperty) {
      airbnbEmailLog.info("property_mapping_resolved", {
        organizationId: input.organizationId,
        propertyId: onProperty.propertyId,
        method: onProperty.method,
        airbnbRoomId: roomId,
      });
      return onProperty;
    }

    const fromMap = await resolvePropertyFromListingMap({
      organizationId: input.organizationId,
      airbnbRoomId: roomId,
      listingName: null,
    });
    if (fromMap && !fromMap.ambiguous && fromMap.propertyId) {
      airbnbEmailLog.info("property_mapping_resolved", {
        organizationId: input.organizationId,
        propertyId: fromMap.propertyId,
        method: "airbnb_room_id_listing_map",
        airbnbRoomId: roomId,
      });
      return {
        propertyId: fromMap.propertyId,
        ambiguous: false,
        method: "airbnb_room_id_listing_map",
        airbnbRoomId: roomId,
      };
    }
    if (fromMap?.ambiguous) {
      airbnbEmailLog.warn("property_mapping_failed", {
        organizationId: input.organizationId,
        reason: "ambiguous_room_id_listing_map",
        airbnbRoomId: roomId,
      });
      return {
        propertyId: null,
        ambiguous: true,
        method: "airbnb_room_id_listing_map",
        airbnbRoomId: roomId,
      };
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
        airbnbEmailLog.info("property_mapping_resolved", {
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
      airbnbEmailLog.info("property_mapping_resolved", {
        organizationId: input.organizationId,
        propertyId: byGuest.propertyId,
        method: byGuest.method,
        guestNameSignal: Boolean(input.guestName),
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

  const listingName = input.listingName?.trim();
  if (listingName && listingName.length >= 4) {
    const fromName = await resolvePropertyFromListingMap({
      organizationId: input.organizationId,
      listingName,
      airbnbRoomId: null,
    });
    if (fromName && !fromName.ambiguous && fromName.propertyId) {
      airbnbEmailLog.info("property_mapping_resolved", {
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
    hadRoomId: Boolean(roomId),
    hadUnit: Boolean(unit),
    hadGuestName: Boolean(input.guestName),
    hadListingName: Boolean(listingName),
  });

  return { propertyId: null, ambiguous: false, method: "none" };
}
