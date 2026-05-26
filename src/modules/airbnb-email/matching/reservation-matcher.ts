import {
  AirbnbEmailMatchMethod,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { findOverlappingReservation } from "@/services/reservations/reservation-conflicts";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import { resolvePropertyIdFromEmailSignals } from "@/modules/airbnb-email/matching/property-resolver";
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
): Promise<Omit<
  ReservationMatchResult,
  "tier" | "allowReservationEnrichment" | "requiresManualReview"
> | null> {
  const overlapCount = await countOverlappingAirbnb(
    propertyId,
    checkIn,
    checkOut,
  );
  if (overlapCount === 0) return null;

  const reservation = await findOverlappingReservation(
    propertyId,
    checkIn,
    checkOut,
  );

  if (!reservation || reservation.platform !== BookingPlatform.AIRBNB) {
    return null;
  }

  if (
    options.organizationId &&
    !(await assertReservationInOrganization(
      reservation.id,
      options.organizationId,
    ))
  ) {
    return null;
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  const unique = overlapCount === 1;
  const confidence =
    unique && options.hasConfirmationCode ? 0.92 : unique ? 0.82 : 0.7;

  return {
    reservationId: reservation.id,
    propertyId,
    organizationId: property?.organizationId ?? null,
    method: AirbnbEmailMatchMethod.LISTING_DATES,
    confidence,
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

export async function matchReservationFromEmailSignals(
  signals: ExtractedReservationSignals,
  options?: MatchReservationOptions,
): Promise<ReservationMatchResult> {
  const organizationId = options?.organizationId ?? null;
  const hasConfirmationCode = Boolean(signals.confirmationCode?.trim());

  if (options?.listingAmbiguous) {
    return applyMatchPolicy(
      {
        reservationId: null,
        propertyId: null,
        organizationId,
        method: AirbnbEmailMatchMethod.NONE,
        confidence: 0,
      },
      { hasConfirmationCodeInEmail: hasConfirmationCode },
    );
  }

  const emptyBase = {
    reservationId: null as string | null,
    propertyId: options?.propertyId ?? null,
    organizationId,
    method: AirbnbEmailMatchMethod.NONE,
    confidence: 0,
  };

  if (signals.confirmationCode) {
    const byCode = await matchByConfirmationCode(
      signals.confirmationCode,
      organizationId,
    );
    if (byCode) {
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
  }

  let propertyId = options?.propertyId ?? null;
  if (!propertyId && organizationId) {
    const resolved = await resolvePropertyIdFromEmailSignals(
      organizationId,
      signals,
      options?.propertyId,
    );
    if (resolved.ambiguous) {
      return applyMatchPolicy(
        { ...emptyBase, confidence: 0 },
        { hasConfirmationCodeInEmail: hasConfirmationCode },
      );
    }
    propertyId = resolved.propertyId;
  }

  const checkIn = parseDateKey(signals.checkIn);
  const checkOut = parseDateKey(signals.checkOut);

  if (propertyId && checkIn && checkOut) {
    const byDates = await matchByListingDates(propertyId, checkIn, checkOut, {
      hasConfirmationCode,
      organizationId,
    });
    if (byDates) {
      return applyMatchPolicy(byDates, {
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
        return applyMatchPolicy(byGuest, {
          hasConfirmationCodeInEmail: hasConfirmationCode,
        });
      }
    }
  }

  return applyMatchPolicy(emptyBase, {
    hasConfirmationCodeInEmail: hasConfirmationCode,
  });
}
