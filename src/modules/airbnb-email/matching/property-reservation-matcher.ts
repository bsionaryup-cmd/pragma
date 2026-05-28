import { AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import type { ContextualMatchBase } from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import {
  guestNameMatches,
  narrowContextualCandidates,
} from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import {
  checkInWithinSlack,
  inferStayDatesFromPropertyCandidates,
  overlapDaysByCalendarDay,
  stayDatesOverlap,
  stayDatesOverlapByCalendarDay,
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

type ScoredPropertyCandidate = {
  candidate: PropertyReservationCandidate;
  dateOverlap: number;
  overlapDays: number;
  guestScore: number;
  confidence: number;
  selectedReason?: string;
};

const CLEAR_WIN_MARGIN = 0.1;
const MIN_AUTO_LINK_CONFIDENCE = 0.78;

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
  if (emailGuest?.trim() && isPlaceholderGuestName(reservationGuest)) {
    return true;
  }
  return false;
}

function scorePropertyReservationCandidate(input: {
  candidate: PropertyReservationCandidate;
  resolvedCheckIn: Date | null;
  resolvedCheckOut: Date | null;
  emailGuest: string | null | undefined;
  hasConfirmationCode: boolean;
}): ScoredPropertyCandidate {
  const { candidate, resolvedCheckIn, resolvedCheckOut, emailGuest, hasConfirmationCode } =
    input;

  let dateOverlap = 0;
  let overlapDays = 0;
  if (resolvedCheckIn) {
    if (
      stayDatesOverlapByCalendarDay(candidate, resolvedCheckIn, resolvedCheckOut)
    ) {
      dateOverlap = 1;
      overlapDays = overlapDaysByCalendarDay(
        candidate,
        resolvedCheckIn,
        resolvedCheckOut,
      );
    } else if (stayDatesOverlap(candidate, resolvedCheckIn, resolvedCheckOut)) {
      dateOverlap = 0.92;
      overlapDays = overlapDaysByCalendarDay(
        candidate,
        resolvedCheckIn,
        resolvedCheckOut,
      );
    } else if (checkInWithinSlack(candidate.checkIn, resolvedCheckIn)) {
      dateOverlap = 0.65;
    }
  }

  let guestScore = 0;
  if (guestSignalMatches(emailGuest, candidate.guestName)) {
    guestScore = 1;
  } else if (emailGuest?.trim() && isPlaceholderGuestName(candidate.guestName)) {
    guestScore = 0.55;
  }

  let confidence = 0.52 + dateOverlap * 0.28 + guestScore * 0.18;
  if (hasConfirmationCode) confidence += 0.04;
  if (candidate.icalUid) confidence += 0.03;
  confidence = Math.min(confidence, 0.97);

  return {
    candidate,
    dateOverlap,
    overlapDays,
    guestScore,
    confidence,
  };
}

function logScoredCandidates(
  propertyId: string,
  scored: ScoredPropertyCandidate[],
  emailGuestName: string | null | undefined,
): void {
  for (const row of scored) {
    airbnbEmailLog.info("reservation_candidate_score", {
      propertyId,
      reservationId: row.candidate.id,
      guestNameFromReservation: row.candidate.guestName,
      guestNameFromEmail: emailGuestName ?? undefined,
      checkIn: row.candidate.checkIn.toISOString(),
      checkOut: row.candidate.checkOut.toISOString(),
      dateOverlap: row.dateOverlap,
      overlapDays: row.overlapDays,
      guestScore: row.guestScore,
      confidence: Number(row.confidence.toFixed(3)),
      selectedReason: row.selectedReason ?? undefined,
    });
  }
}

function logRejectedCandidates(
  propertyId: string,
  scored: ScoredPropertyCandidate[],
  selectedId: string | null,
  rejectionReason: string,
): void {
  for (const row of scored) {
    if (row.candidate.id === selectedId) continue;
    airbnbEmailLog.info("reservation_candidate_rejected", {
      propertyId,
      reservationId: row.candidate.id,
      guestNameFromReservation: row.candidate.guestName,
      checkIn: row.candidate.checkIn.toISOString(),
      checkOut: row.candidate.checkOut.toISOString(),
      dateOverlap: row.dateOverlap,
      overlapDays: row.overlapDays,
      guestScore: row.guestScore,
      confidence: Number(row.confidence.toFixed(3)),
      rejectionReason,
    });
  }
}

function pickScoredWinner(input: {
  propertyId: string;
  scored: ScoredPropertyCandidate[];
  requireGuestSignal: boolean;
}): ScoredPropertyCandidate | null {
  const viable = input.scored.filter((row) => {
    if (row.confidence < MIN_AUTO_LINK_CONFIDENCE) return false;
    if (row.dateOverlap >= 0.65) return true;
    if (row.guestScore >= 1 && row.dateOverlap >= 0.5) return true;
    if (!input.requireGuestSignal && row.dateOverlap >= 0.92) return true;
    return false;
  });

  if (viable.length === 0) return null;

  const ranked = [...viable].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0]!;
  const second = ranked[1] ?? null;

  if (!second) {
    top.selectedReason = "single_viable_candidate";
    return top;
  }

  const margin = top.confidence - second.confidence;
  if (margin >= CLEAR_WIN_MARGIN) {
    top.selectedReason = "clear_confidence_winner";
    return top;
  }

  if (
    top.dateOverlap >= 1 &&
    top.guestScore >= 0.5 &&
    (second.dateOverlap < 0.65 || second.guestScore < 0.5)
  ) {
    top.selectedReason = "exact_overlap_beats_weak_second";
    return top;
  }

  if (top.dateOverlap >= 1 && top.guestScore >= 1) {
    top.selectedReason = "exact_overlap_and_guest";
    return top;
  }

  if (top.dateOverlap >= 1 && second.dateOverlap < 1) {
    top.selectedReason = "exact_overlap_unique";
    airbnbEmailLog.info("guest_score_ignored_due_to_exact_date_overlap", {
      propertyId: input.propertyId,
      reservationId: top.candidate.id,
      guestScoreTop: top.guestScore,
      guestScoreSecond: second.guestScore,
      topDateOverlap: top.dateOverlap,
      secondDateOverlap: second.dateOverlap,
    });
    return top;
  }

  logRejectedCandidates(
    input.propertyId,
    input.scored,
    null,
    "confidence_too_close",
  );
  airbnbEmailLog.warn("reservation_candidate_rejected", {
    propertyId: input.propertyId,
    reason: "confidence_too_close",
    topReservationId: top.candidate.id,
    secondReservationId: second.candidate.id,
    topConfidence: top.confidence,
    secondConfidence: second.confidence,
  });
  return null;
}

function buildPropertyScopedMatch(
  selected: PropertyReservationCandidate,
  scored: ScoredPropertyCandidate,
  input: {
    decisiveSignal: string;
    propertyId: string;
    hasConfirmationCode: boolean;
    emailGuestName: string | null | undefined;
  },
): ContextualMatchBase {
  const guestNameMatch = scored.guestScore >= 1;
  const dateOverlap = scored.dateOverlap >= 0.65;

  airbnbEmailLog.info("reservation_candidate_selected", {
    propertyId: input.propertyId,
    reservationId: selected.id,
    confidence: scored.confidence,
    decisiveSignal: input.decisiveSignal,
    selectedReason: scored.selectedReason ?? input.decisiveSignal,
    guestNameMatch,
    dateOverlap,
    dateOverlapScore: scored.dateOverlap,
    overlapDays: scored.overlapDays,
    guestScore: scored.guestScore,
    guestNameFromReservation: selected.guestName,
    guestNameFromEmail: input.emailGuestName ?? undefined,
    hasConfirmationCode: input.hasConfirmationCode,
    icalUid: selected.icalUid ?? undefined,
    checkIn: selected.checkIn.toISOString(),
    checkOut: selected.checkOut.toISOString(),
  });

  return {
    reservationId: selected.id,
    propertyId: selected.propertyId,
    organizationId: selected.organizationId,
    method:
      scored.dateOverlap >= 0.95
        ? AirbnbEmailMatchMethod.LISTING_DATES
        : AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH,
    confidence: scored.confidence,
  };
}

/**
 * Resolves reservationId when propertyId is already known (post listing/property match).
 */
export async function matchReservationByPropertyContext(input: {
  propertyId: string;
  organizationId: string;
  signals: ExtractedReservationSignals;
  parsedCheckIn: Date | null;
  parsedCheckOut: Date | null;
}): Promise<ContextualMatchBase | null> {
  const hasConfirmationCode = Boolean(input.signals.confirmationCode?.trim());
  const hasGuestName = Boolean(input.signals.guestName?.trim());

  airbnbEmailLog.info("property_reservation_match_started", {
    propertyId: input.propertyId,
    organizationId: input.organizationId,
    hasGuestName,
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
    candidates: candidates
      .map(
        (c) =>
          `${c.id}:${c.guestName}:${c.checkIn.toISOString().slice(0, 10)}→${c.checkOut.toISOString().slice(0, 10)}`,
      )
      .join("|"),
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

  const scored = candidates.map((candidate) =>
    scorePropertyReservationCandidate({
      candidate,
      resolvedCheckIn: resolvedDates.checkIn,
      resolvedCheckOut: resolvedDates.checkOut,
      emailGuest: input.signals.guestName,
      hasConfirmationCode,
    }),
  );
  logScoredCandidates(input.propertyId, scored, input.signals.guestName);

  const narrowed = narrowContextualCandidates(
    candidates,
    input.signals,
    resolvedDates.checkIn,
    resolvedDates.checkOut,
  );

  if (narrowed.length === 1) {
    const selected = narrowed[0]!;
    const row =
      scored.find((s) => s.candidate.id === selected.id) ??
      scorePropertyReservationCandidate({
        candidate: selected,
        resolvedCheckIn: resolvedDates.checkIn,
        resolvedCheckOut: resolvedDates.checkOut,
        emailGuest: input.signals.guestName,
        hasConfirmationCode,
      });
    row.selectedReason = "narrow_single_winner";
    logRejectedCandidates(
      input.propertyId,
      scored,
      selected.id,
      "narrow_single_winner",
    );
    return buildPropertyScopedMatch(selected, row, {
      propertyId: input.propertyId,
      decisiveSignal: "property_narrow:single",
      hasConfirmationCode,
      emailGuestName: input.signals.guestName,
    });
  }

  const winner = pickScoredWinner({
    propertyId: input.propertyId,
    scored,
    requireGuestSignal: hasGuestName,
  });

  if (winner) {
    if (winner.dateOverlap >= 0.95) {
      winner.selectedReason = "PROPERTY_DATE_EXACT_MATCH";
      airbnbEmailLog.info("guest_score_ignored_due_to_exact_date_overlap", {
        propertyId: input.propertyId,
        reservationId: winner.candidate.id,
        guestScore: winner.guestScore,
        dateOverlap: winner.dateOverlap,
      });
    }
    logRejectedCandidates(
      input.propertyId,
      scored,
      winner.candidate.id,
      "outscored",
    );
    return buildPropertyScopedMatch(winner.candidate, winner, {
      propertyId: input.propertyId,
      decisiveSignal: "property_scored:winner",
      hasConfirmationCode,
      emailGuestName: input.signals.guestName,
    });
  }

  airbnbEmailLog.warn("property_reservation_match_rejected", {
    propertyId: input.propertyId,
    reason: "no_unique_safe_candidate",
    candidateCount: candidates.length,
    narrowedCount: narrowed.length,
    hasGuestName,
    hasResolvedCheckIn: Boolean(resolvedDates.checkIn),
  });

  return null;
}
