import {
  BookingPlatform,
  ReservationStatus,
  AirbnbEmailMatchMethod,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

type ContextualCandidate = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  icalUid: string | null;
  organizationId: string | null;
};

export type ContextualMatchBase = {
  reservationId: string;
  propertyId: string;
  organizationId: string | null;
  method: AirbnbEmailMatchMethod;
  confidence: number;
};

export function guestNameMatches(
  emailGuest: string | null | undefined,
  reservationGuest: string,
): boolean {
  if (!emailGuest?.trim()) return false;
  const token = emailGuest.trim().split(/\s+/)[0]?.toLowerCase();
  if (!token || token.length < 2) return false;
  return reservationGuest.toLowerCase().includes(token);
}

function datesOverlap(
  checkIn: Date,
  checkOut: Date,
  parsedCheckIn: Date | null,
  parsedCheckOut: Date | null,
): boolean {
  if (!parsedCheckIn || !parsedCheckOut) return false;
  return checkIn < parsedCheckOut && checkOut > parsedCheckIn;
}

export function scoreContextualCandidate(input: {
  candidate: ContextualCandidate;
  hasConfirmationCode: boolean;
  guestName: string | null | undefined;
  parsedCheckIn: Date | null;
  parsedCheckOut: Date | null;
}): number {
  let score = 0.78;
  if (input.hasConfirmationCode) score += 0.08;
  if (input.candidate.icalUid) score += 0.04;
  if (
    guestNameMatches(input.guestName, input.candidate.guestName) &&
    !isPlaceholderGuestName(input.candidate.guestName)
  ) {
    score += 0.06;
  } else if (
    input.guestName?.trim() &&
    isPlaceholderGuestName(input.candidate.guestName)
  ) {
    score += 0.04;
  }
  if (
    datesOverlap(
      input.candidate.checkIn,
      input.candidate.checkOut,
      input.parsedCheckIn,
      input.parsedCheckOut,
    )
  ) {
    score += 0.04;
  }
  return Math.min(score, 0.94);
}

async function loadContextualCandidates(input: {
  propertyId: string;
  organizationId?: string | null;
}): Promise<ContextualCandidate[]> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 1);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 120);

  const rows = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      propertyId: input.propertyId,
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      checkOut: { gte: windowStart },
      checkIn: { lte: windowEnd },
      ...(input.organizationId
        ? { property: { organizationId: input.organizationId } }
        : {}),
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

export function narrowContextualCandidates(
  candidates: ContextualCandidate[],
  signals: ExtractedReservationSignals,
  parsedCheckIn: Date | null,
  parsedCheckOut: Date | null,
): ContextualCandidate[] {
  if (parsedCheckIn && parsedCheckOut) {
    const byDates = candidates.filter((c) =>
      datesOverlap(c.checkIn, c.checkOut, parsedCheckIn, parsedCheckOut),
    );
    if (byDates.length === 1) return byDates;
    if (byDates.length > 1) {
      const byGuest = byDates.filter((c) =>
        guestNameMatches(signals.guestName, c.guestName),
      );
      if (byGuest.length === 1) return byGuest;
      return [];
    }
  }

  if (candidates.length === 1) return candidates;

  const byGuest = candidates.filter((c) =>
    guestNameMatches(signals.guestName, c.guestName),
  );
  if (byGuest.length === 1) return byGuest;

  return [];
}

export async function matchByListingContextual(input: {
  propertyId: string;
  organizationId?: string | null;
  signals: ExtractedReservationSignals;
  parsedCheckIn: Date | null;
  parsedCheckOut: Date | null;
}): Promise<ContextualMatchBase | null> {
  const hasConfirmationCode = Boolean(input.signals.confirmationCode?.trim());
  if (!hasConfirmationCode) {
    airbnbEmailLog.info("contextual_match_rejected", {
      propertyId: input.propertyId,
      reason: "missing_confirmation_code",
    });
    return null;
  }

  const candidates = await loadContextualCandidates({
    propertyId: input.propertyId,
    organizationId: input.organizationId,
  });

  airbnbEmailLog.info("contextual_match_candidate", {
    propertyId: input.propertyId,
    candidateCount: candidates.length,
    hasParsedDates: Boolean(input.parsedCheckIn && input.parsedCheckOut),
    hasGuestName: Boolean(input.signals.guestName),
    confirmationCode: input.signals.confirmationCode ?? undefined,
  });

  if (candidates.length === 0) {
    airbnbEmailLog.info("contextual_match_rejected", {
      propertyId: input.propertyId,
      reason: "no_active_ical_candidates",
    });
    return null;
  }

  airbnbEmailLog.info("contextual_candidate_found", {
    propertyId: input.propertyId,
    candidateCount: candidates.length,
    reservationIds: candidates.map((c) => c.id).join(","),
  });

  const narrowed = narrowContextualCandidates(
    candidates,
    input.signals,
    input.parsedCheckIn,
    input.parsedCheckOut,
  );

  if (narrowed.length !== 1) {
    airbnbEmailLog.warn("contextual_match_rejected", {
      propertyId: input.propertyId,
      reason: narrowed.length === 0 ? "ambiguous_or_no_match" : "multiple_candidates",
      candidateCount: candidates.length,
      narrowedCount: narrowed.length,
    });
    return null;
  }

  const selected = narrowed[0]!;
  const confidence = scoreContextualCandidate({
    candidate: selected,
    hasConfirmationCode,
    guestName: input.signals.guestName,
    parsedCheckIn: input.parsedCheckIn,
    parsedCheckOut: input.parsedCheckOut,
  });

  if (confidence < 0.84) {
    airbnbEmailLog.warn("contextual_match_rejected", {
      propertyId: input.propertyId,
      reservationId: selected.id,
      reason: "confidence_below_threshold",
      confidence,
    });
    return null;
  }

  airbnbEmailLog.info("contextual_match_selected", {
    propertyId: input.propertyId,
    reservationId: selected.id,
    confidence,
    hasIcalUid: Boolean(selected.icalUid),
    usedParsedDates: Boolean(
      input.parsedCheckIn &&
        input.parsedCheckOut &&
        datesOverlap(
          selected.checkIn,
          selected.checkOut,
          input.parsedCheckIn,
          input.parsedCheckOut,
        ),
    ),
    guestNameSignal: Boolean(
      guestNameMatches(input.signals.guestName, selected.guestName),
    ),
  });

  return {
    reservationId: selected.id,
    propertyId: selected.propertyId,
    organizationId: selected.organizationId,
    method: AirbnbEmailMatchMethod.LISTING_CONTEXTUAL_MATCH,
    confidence,
  };
}
