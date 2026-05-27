import {
  AirbnbEmailMatchMethod,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { findOverlappingReservation } from "@/services/reservations/reservation-conflicts";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import { matchByListingContextual } from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import { resolvePropertyIdFromEmailSignals } from "@/modules/airbnb-email/matching/property-resolver";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import type {
  ExtractedReservationSignals,
  ReservationMatchResult,
} from "@/modules/airbnb-email/types";

export type MatchReservationOptions = {
  propertyId?: string | null;
  organizationId?: string | null;
  listingAmbiguous?: boolean;
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

function organizationReservationFilter(
  organizationId: string | null | undefined,
): Prisma.ReservationWhereInput {
  if (!organizationId) return {};
  return { property: { organizationId } };
}

async function assertReservationInOrganization(
  reservationId: string,
  organizationId: string,
): Promise<boolean> {
  const row = await db.reservation.findFirst({
    where: {
      id: reservationId,
      property: { organizationId },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function countOverlappingAirbnb(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<number> {
  return db.reservation.count({
    where: withVisibleReservationsFilter({
      propertyId,
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    }),
  });
}

async function matchByConfirmationCode(
  code: string,
  organizationId?: string | null,
): Promise<Omit<
  ReservationMatchResult,
  "tier" | "allowReservationEnrichment" | "requiresManualReview"
> | null> {
  const reservation = await db.reservation.findFirst({
    where: withVisibleReservationsFilter({
      reservationCode: code,
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      ...organizationReservationFilter(organizationId),
    }),
    select: {
      id: true,
      propertyId: true,
      property: { select: { organizationId: true } },
    },
  });

  if (!reservation) return null;

  return {
    reservationId: reservation.id,
    propertyId: reservation.propertyId,
    organizationId: reservation.property.organizationId,
    method: AirbnbEmailMatchMethod.CONFIRMATION_CODE,
    confidence: 0.98,
  };
}

async function matchByListingDates(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  options: { hasConfirmationCode: boolean; organizationId?: string | null },
): Promise<{
  match: Omit<
    ReservationMatchResult,
    "tier" | "allowReservationEnrichment" | "requiresManualReview"
  > | null;
  overlapCount: number;
  decisiveSignal: string | null;
}> {
  const overlapCount = await countOverlappingAirbnb(
    propertyId,
    checkIn,
    checkOut,
  );
  if (overlapCount === 0) {
    return { match: null, overlapCount: 0, decisiveSignal: null };
  }

  const reservation = await findOverlappingReservation(
    propertyId,
    checkIn,
    checkOut,
  );

  if (!reservation || reservation.platform !== BookingPlatform.AIRBNB) {
    return { match: null, overlapCount, decisiveSignal: null };
  }

  if (
    options.organizationId &&
    !(await assertReservationInOrganization(
      reservation.id,
      options.organizationId,
    ))
  ) {
    return { match: null, overlapCount, decisiveSignal: null };
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  const unique = overlapCount === 1;
  const confidence =
    unique && options.hasConfirmationCode ? 0.92 : unique ? 0.88 : 0.7;
  const decisiveSignal = unique
    ? "property+ical_dates_unique"
    : "property+ical_dates_overlap";

  return {
    overlapCount,
    decisiveSignal,
    match: {
      reservationId: reservation.id,
      propertyId,
      organizationId: property?.organizationId ?? null,
      method: AirbnbEmailMatchMethod.LISTING_DATES,
      confidence,
    },
  };
}

async function matchByListingGuestDates(
  propertyId: string,
  guestName: string,
  checkIn: Date,
  checkOut: Date,
  organizationId?: string | null,
): Promise<Omit<
  ReservationMatchResult,
  "tier" | "allowReservationEnrichment" | "requiresManualReview"
> | null> {
  const firstToken = guestName.split(/\s+/)[0] ?? guestName;
  const reservation = await db.reservation.findFirst({
    where: withVisibleReservationsFilter({
      propertyId,
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      checkIn,
      checkOut,
      guestName: { contains: firstToken, mode: "insensitive" },
      ...organizationReservationFilter(organizationId),
    }),
    select: {
      id: true,
      propertyId: true,
      property: { select: { organizationId: true } },
    },
  });

  if (!reservation) return null;

  return {
    reservationId: reservation.id,
    propertyId: reservation.propertyId,
    organizationId: reservation.property.organizationId,
    method: AirbnbEmailMatchMethod.LISTING_GUEST_DATES,
    confidence: 0.72,
  };
}

function canAttemptIcalContextualMatch(input: {
  organizationId: string | null;
  guestName: string | null | undefined;
}): boolean {
  return Boolean(input.organizationId && isPlausibleGuestName(input.guestName));
}

export async function matchReservationFromEmailSignals(
  signals: ExtractedReservationSignals,
  options?: MatchReservationOptions,
): Promise<ReservationMatchResult> {
  const organizationId = options?.organizationId ?? null;
  const hasConfirmationCode = Boolean(signals.confirmationCode?.trim());
  const checkIn = parseDateKey(signals.checkIn);
  const checkOut = parseDateKey(signals.checkOut);

  const emptyBase = {
    reservationId: null as string | null,
    propertyId: options?.propertyId ?? null,
    organizationId,
    method: AirbnbEmailMatchMethod.NONE,
    confidence: 0,
  };

  airbnbEmailLog.info("match_flow_started", {
    organizationId,
    hasGuestName: Boolean(signals.guestName),
    guestName: signals.guestName ?? undefined,
    hasConfirmationCode,
    hasListingName: Boolean(signals.listingName),
    hasCheckIn: Boolean(signals.checkIn),
    hasCheckOut: Boolean(signals.checkOut),
    providedPropertyId: Boolean(options?.propertyId),
    listingAmbiguous: Boolean(options?.listingAmbiguous),
  });

  let propertyId = options?.propertyId ?? null;
  let propertyResolutionAmbiguous = false;
  if (!propertyId && organizationId) {
    const resolved = await resolvePropertyIdFromEmailSignals(
      organizationId,
      signals,
      options?.propertyId,
    );
    propertyResolutionAmbiguous = resolved.ambiguous;
    propertyId = resolved.propertyId;
    if (resolved.ambiguous) {
      airbnbEmailLog.warn("property_mapping_failed", {
        organizationId,
        reason: "ambiguous_property_resolution",
        listingName: signals.listingName ?? undefined,
      });
    } else if (!propertyId) {
      airbnbEmailLog.warn("property_mapping_failed", {
        organizationId,
        reason: "no_metadata_match",
        listingName: signals.listingName ?? undefined,
      });
    } else {
      airbnbEmailLog.info("property_mapping_resolved", {
        organizationId,
        propertyId,
        method: resolved.resolutionMethod,
        listingName: signals.listingName ?? undefined,
      });
    }
  }

  if (propertyId && checkIn && checkOut) {
    airbnbEmailLog.info("ical_date_match_started", {
      propertyId,
      checkIn: signals.checkIn ?? undefined,
      checkOut: signals.checkOut ?? undefined,
    });

    const dateMatch = await matchByListingDates(propertyId, checkIn, checkOut, {
      hasConfirmationCode,
      organizationId,
    });

    if (dateMatch.overlapCount > 0) {
      airbnbEmailLog.info("ical_date_match_found", {
        propertyId,
        overlapCount: dateMatch.overlapCount,
        checkIn: signals.checkIn ?? undefined,
        checkOut: signals.checkOut ?? undefined,
      });
    }

    if (dateMatch.match) {
      airbnbEmailLog.info("ical_date_match_selected", {
        propertyId,
        reservationId: dateMatch.match.reservationId,
        overlapCount: dateMatch.overlapCount,
        decisiveSignal: dateMatch.decisiveSignal ?? "property+ical_dates",
        method: dateMatch.match.method,
        confidence: dateMatch.match.confidence,
      });
      airbnbEmailLog.info("match_branch_selected", {
        branch: "LISTING_DATES",
        reservationId: dateMatch.match.reservationId,
        decisiveSignal: dateMatch.decisiveSignal,
      });
      return applyMatchPolicy(dateMatch.match, {
        hasConfirmationCodeInEmail: hasConfirmationCode,
      });
    }

    if (signals.guestName?.trim()) {
      const byGuest = await matchByListingGuestDates(
        propertyId,
        signals.guestName.trim(),
        checkIn,
        checkOut,
        organizationId,
      );
      if (byGuest) {
        airbnbEmailLog.info("ical_date_match_selected", {
          propertyId,
          reservationId: byGuest.reservationId,
          decisiveSignal: "property+exact_dates+guestName",
          method: byGuest.method,
        });
        airbnbEmailLog.info("match_branch_selected", {
          branch: "LISTING_GUEST_DATES",
          reservationId: byGuest.reservationId,
        });
        return applyMatchPolicy(byGuest, {
          hasConfirmationCodeInEmail: hasConfirmationCode,
        });
      }
    }
  }

  if (propertyId && organizationId) {
    const contextualWithProperty = await matchByListingContextual({
      propertyId,
      organizationId,
      signals,
      parsedCheckIn: checkIn,
      parsedCheckOut: checkOut,
    });
    if (contextualWithProperty) {
      airbnbEmailLog.info("match_branch_selected", {
        branch: "ICAL_CONTEXTUAL_MATCH",
        reservationId: contextualWithProperty.reservationId,
        propertyIdHint: propertyId,
        decisiveSignal: "property+ical_context",
      });
      return applyMatchPolicy(contextualWithProperty, {
        hasConfirmationCodeInEmail: hasConfirmationCode,
      });
    }
  }

  if (canAttemptIcalContextualMatch({ organizationId, guestName: signals.guestName })) {
    const contextual = await matchByListingContextual({
      propertyId: null,
      organizationId: organizationId!,
      signals,
      parsedCheckIn: checkIn,
      parsedCheckOut: checkOut,
    });
    if (contextual) {
      airbnbEmailLog.info("match_branch_selected", {
        branch: "ICAL_CONTEXTUAL_MATCH",
        reservationId: contextual.reservationId,
        propertyId: contextual.propertyId,
        decisiveSignal: "guestName+ical_context",
        confidence: contextual.confidence,
      });
      return applyMatchPolicy(contextual, {
        hasConfirmationCodeInEmail: hasConfirmationCode,
      });
    }
    airbnbEmailLog.info("match_branch_skipped", {
      branch: "ICAL_CONTEXTUAL_MATCH",
      reason: "no_unique_ical_context_match",
    });
  } else {
    airbnbEmailLog.warn("ical_context_skipped", {
      organizationId: organizationId ?? undefined,
      reason: !organizationId
        ? "missing_organization_id"
        : "missing_or_invalid_guest_name",
      guestName: signals.guestName ?? undefined,
    });
  }

  if (signals.confirmationCode) {
    const byCode = await matchByConfirmationCode(
      signals.confirmationCode,
      organizationId,
    );
    if (byCode) {
      airbnbEmailLog.info("match_branch_selected", {
        branch: "CONFIRMATION_CODE",
        reservationId: byCode.reservationId,
        decisiveSignal: "hm_code_in_db",
      });
      if (
        organizationId &&
        byCode.organizationId &&
        byCode.organizationId !== organizationId
      ) {
        return applyMatchPolicy(
          { ...emptyBase, confidence: 0 },
          { hasConfirmationCodeInEmail: hasConfirmationCode },
        );
      }
      return applyMatchPolicy(byCode, { hasConfirmationCodeInEmail: true });
    }
    airbnbEmailLog.info("match_branch_skipped", {
      branch: "CONFIRMATION_CODE",
      reason: "no_db_reservation_with_code",
    });
  }

  if (propertyResolutionAmbiguous) {
    airbnbEmailLog.warn("match_flow_manual_review", {
      organizationId,
      reason: "property_mapping_ambiguous",
    });
  }

  airbnbEmailLog.warn("match_flow_no_match", {
    organizationId,
    hasGuestName: Boolean(signals.guestName),
    hasListingName: Boolean(signals.listingName),
    hasCheckIn: Boolean(signals.checkIn),
    hasCheckOut: Boolean(signals.checkOut),
    providedPropertyId: Boolean(options?.propertyId),
    propertyResolutionAmbiguous,
  });

  return applyMatchPolicy(emptyBase, {
    hasConfirmationCodeInEmail: hasConfirmationCode,
  });
}
