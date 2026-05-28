import { AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import type { ContextualMatchBase } from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import {
  guestNameMatches,
  narrowContextualCandidates,
} from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import {
  inferStayDatesFromPropertyCandidates,
  stayDatesOverlap,
} from "@/modules/airbnb-email/matching/stay-date-resolve";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import { db } from "@/lib/db";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { BookingPlatform, ReservationStatus } from "@prisma/client";

type PropertyReservationCandidate = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  icalUid: string | null;
  organizationId: string | null;
};

async function loadPropertyReservationCandidates(input: {
  propertyId: string;
  organizationId: string;
}): Promise<PropertyReservationCandidate[]> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 180);

  const rows = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      propertyId: input.propertyId,
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      checkOut: { gte: windowStart },
      checkIn: { lte: windowEnd },
      property: { organizationId: input.organizationId },
    }),
    select: {
      id: true,
      propertyId: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      icalUid: true,
      property: { select: { organizationId: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    propertyId: row.propertyId,
    guestName: row.guestName,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    icalUid: row.icalUid,
    organizationId: row.property.organizationId,
  }));
}

function guestSignalMatches(
  emailGuest: string | null | undefined,
  reservationGuest: string,
): boolean {
  if (guestNameMatches(emailGuest, reservationGuest)) return true;
  if (
    emailGuest?.trim() &&
    isPlaceholderGuestName(reservationGuest)
  ) {
    return true;
  }
  return false;
}

function buildPropertyScopedMatch(
  selected: PropertyReservationCandidate,
  input: {
    confidence: number;
    decisiveSignal: string;
    propertyId: string;
    hasConfirmationCode: boolean;
    guestNameMatch: boolean;
    dateOverlap: boolean;
  },
): ContextualMatchBase {
  airbnbEmailLog.info("reservation_candidate_selected", {
    propertyId: input.propertyId,
    reservationId: selected.id,
    confidence: input.confidence,
    decisiveSignal: input.decisiveSignal,
    guestNameMatch: input.guestNameMatch,
    dateOverlap: input.dateOverlap,
    hasConfirmationCode: input.hasConfirmationCode,
    icalUid: selected.icalUid ?? undefined,
    guestNameIcal: selected.guestName,
  });

  return {
    reservationId: selected.id,
    propertyId: selected.propertyId,
    organizationId: selected.organizationId,
    method: AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH,
    confidence: input.confidence,
  };
}

/**
 * Resolves reservationId when propertyId is already known (post listing/property match).
 * Safe auto-link only for a single reasonable iCal candidate.
 */
export async function matchReservationByPropertyContext(input: {
  propertyId: string;
  organizationId: string;
  signals: ExtractedReservationSignals;
  parsedCheckIn: Date | null;
  parsedCheckOut: Date | null;
}): Promise<ContextualMatchBase | null> {
  const hasConfirmationCode = Boolean(input.signals.confirmationCode?.trim());

  airbnbEmailLog.info("property_reservation_match_started", {
    propertyId: input.propertyId,
    organizationId: input.organizationId,
    hasGuestName: Boolean(input.signals.guestName),
    hasParsedCheckIn: Boolean(input.parsedCheckIn),
    hasParsedCheckOut: Boolean(input.parsedCheckOut),
    guestName: input.signals.guestName ?? undefined,
    checkIn: input.signals.checkIn ?? undefined,
    checkOut: input.signals.checkOut ?? undefined,
  });

  const candidates = await loadPropertyReservationCandidates({
    propertyId: input.propertyId,
    organizationId: input.organizationId,
  });

  airbnbEmailLog.info("reservation_candidate_pool", {
    propertyId: input.propertyId,
    candidateCount: candidates.length,
    reservationIds: candidates.map((c) => c.id).join(","),
  });

  if (candidates.length === 0) {
    airbnbEmailLog.warn("property_reservation_match_rejected", {
      propertyId: input.propertyId,
      reason: "no_active_reservations_on_property",
    });
    return null;
  }

  const resolvedDates = inferStayDatesFromPropertyCandidates(
    input.parsedCheckIn,
    input.parsedCheckOut,
    candidates,
  );

  if (resolvedDates.inferredCheckOutFromIcal) {
    airbnbEmailLog.info("stay_dates_inferred_from_ical", {
      propertyId: input.propertyId,
      checkIn: resolvedDates.checkIn?.toISOString(),
      checkOut: resolvedDates.checkOut?.toISOString(),
    });
  }

  const narrowed = narrowContextualCandidates(
    candidates,
    input.signals,
    resolvedDates.checkIn,
    resolvedDates.checkOut,
  );

  if (narrowed.length === 1) {
    const selected = narrowed[0]!;
    const guestNameMatch = guestSignalMatches(
      input.signals.guestName,
      selected.guestName,
    );
    const dateOverlap = stayDatesOverlap(
      selected,
      resolvedDates.checkIn,
      resolvedDates.checkOut,
    );
    let confidence = 0.86;
    if (guestNameMatch) confidence += 0.06;
    if (dateOverlap) confidence += 0.05;
    if (hasConfirmationCode) confidence += 0.03;
    confidence = Math.min(confidence, 0.96);

    return buildPropertyScopedMatch(selected, {
      propertyId: input.propertyId,
      confidence,
      decisiveSignal: guestNameMatch
        ? dateOverlap
          ? "property_narrow:guest+dates"
          : "property_narrow:guest"
        : dateOverlap
          ? "property_narrow:dates"
          : "property_narrow:single",
      hasConfirmationCode,
      guestNameMatch,
      dateOverlap,
    });
  }

  if (narrowed.length > 1) {
    airbnbEmailLog.warn("property_reservation_match_rejected", {
      propertyId: input.propertyId,
      reason: "narrow_multiple_candidates",
      candidateCount: narrowed.length,
    });
    return null;
  }

  let filtered = [...candidates];

  if (resolvedDates.checkIn) {
    const byDates = filtered.filter((c) =>
      stayDatesOverlap(c, resolvedDates.checkIn, resolvedDates.checkOut),
    );
    if (byDates.length > 0) filtered = byDates;
  }

  if (input.signals.guestName?.trim()) {
    const byGuest = filtered.filter((c) =>
      guestSignalMatches(input.signals.guestName, c.guestName),
    );
    if (byGuest.length === 1) {
      const selected = byGuest[0]!;
      return buildPropertyScopedMatch(selected, {
        propertyId: input.propertyId,
        confidence: 0.9,
        decisiveSignal: "property_filter:unique_guest",
        hasConfirmationCode,
        guestNameMatch: true,
        dateOverlap: stayDatesOverlap(
          selected,
          resolvedDates.checkIn,
          resolvedDates.checkOut,
        ),
      });
    }
    if (byGuest.length > 1) {
      airbnbEmailLog.warn("property_reservation_match_rejected", {
        propertyId: input.propertyId,
        reason: "ambiguous_guest_on_property",
        candidateCount: byGuest.length,
      });
      return null;
    }
  }

  if (filtered.length === 1) {
    const selected = filtered[0]!;
    const guestNameMatch = guestSignalMatches(
      input.signals.guestName,
      selected.guestName,
    );
    if (
      guestNameMatch ||
      hasConfirmationCode ||
      resolvedDates.checkIn
    ) {
      return buildPropertyScopedMatch(selected, {
        propertyId: input.propertyId,
        confidence: guestNameMatch ? 0.88 : 0.86,
        decisiveSignal: "property_filter:single_remaining",
        hasConfirmationCode,
        guestNameMatch,
        dateOverlap: stayDatesOverlap(
          selected,
          resolvedDates.checkIn,
          resolvedDates.checkOut,
        ),
      });
    }
  }

  if (candidates.length === 1) {
    const selected = candidates[0]!;
    const guestNameMatch = guestSignalMatches(
      input.signals.guestName,
      selected.guestName,
    );
    if (guestNameMatch || hasConfirmationCode) {
      return buildPropertyScopedMatch(selected, {
        propertyId: input.propertyId,
        confidence: 0.87,
        decisiveSignal: "property_only_active_reservation",
        hasConfirmationCode,
        guestNameMatch,
        dateOverlap: stayDatesOverlap(
          selected,
          resolvedDates.checkIn,
          resolvedDates.checkOut,
        ),
      });
    }
  }

  airbnbEmailLog.warn("property_reservation_match_rejected", {
    propertyId: input.propertyId,
    reason: "no_unique_safe_candidate",
    candidateCount: candidates.length,
    filteredCount: filtered.length,
    hasGuestName: Boolean(input.signals.guestName),
    hasResolvedCheckIn: Boolean(resolvedDates.checkIn),
  });

  return null;
}
