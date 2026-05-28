import { AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import type { ContextualMatchBase } from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import {
  guestNameMatches,
  narrowContextualCandidates,
} from "@/modules/airbnb-email/matching/contextual-reservation-matcher";
import {
  guestNameMatchStrength,
  normalizeGuestName,
} from "@/modules/airbnb-email/matching/guest-name-normalize";
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
  reservationCode: string | null;
};

type ScoredPropertyCandidate = {
  candidate: PropertyReservationCandidate;
  dateOverlap: number;
  overlapDays: number;
  guestScore: number;
  confidence: number;
  hmMatch: boolean;
  selectedReason?: string;
};

const MIN_AUTO_LINK_CONFIDENCE = 0.88;
const MIN_DATE_OVERLAP_FOR_SAFE = 0.95;
const MIN_NORMALIZED_GUEST_SCORE = 0.85;

function logReconciliationInputSnapshot(input: {
  organizationId: string;
  propertyId: string;
  signals: ExtractedReservationSignals;
  normalizedListing: string | null;
  scored: ScoredPropertyCandidate[];
  selectedReservationId: string | null;
}): void {
  airbnbEmailLog.info("reconciliation_input_snapshot", {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    extractedListing: input.signals.listingName ?? undefined,
    normalizedListing: input.normalizedListing ?? undefined,
    extractedGuestName: input.signals.guestName ?? undefined,
    extractedCheckIn: input.signals.checkIn ?? undefined,
    extractedCheckOut: input.signals.checkOut ?? undefined,
    candidatesFound: input.scored.length,
    candidateScores:
      input.scored.length > 0
        ? JSON.stringify(
            input.scored.map((row) => ({
              reservationId: row.candidate.id,
              guestScore: Number(row.guestScore.toFixed(3)),
              dateOverlap: Number(row.dateOverlap.toFixed(3)),
              overlapDays: row.overlapDays,
              confidence: Number(row.confidence.toFixed(3)),
              hmMatch: row.hmMatch,
            })),
          )
        : "[]",
    selectedReservationId: input.selectedReservationId ?? undefined,
  });
}

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
      reservationCode: true,
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
    reservationCode: row.reservationCode,
  }));
}

async function scanPropertyReservationsForDebug(input: {
  propertyId: string;
  organizationId: string;
}): Promise<
  Array<{
    id: string;
    status: ReservationStatus;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    createdAt: Date;
  }>
> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 180);

  return db.reservation.findMany({
    where: withVisibleReservationsFilter({
      propertyId: input.propertyId,
      platform: BookingPlatform.AIRBNB,
      checkOut: { gte: windowStart },
      checkIn: { lte: windowEnd },
      property: { organizationId: input.organizationId },
    }),
    select: {
      id: true,
      status: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
    },
    orderBy: { checkIn: "asc" },
  });
}

function resolveHmMatch(
  emailConfirmationCode: string | null | undefined,
  reservationCode: string | null,
): boolean {
  const emailCode = emailConfirmationCode?.trim();
  const reservationHm = reservationCode?.trim();
  if (!emailCode || !reservationHm) return false;
  return emailCode.toLowerCase() === reservationHm.toLowerCase();
}

function scorePropertyReservationCandidate(input: {
  candidate: PropertyReservationCandidate;
  resolvedCheckIn: Date | null;
  resolvedCheckOut: Date | null;
  emailGuest: string | null | undefined;
  hasConfirmationCode: boolean;
  emailConfirmationCode: string | null | undefined;
}): ScoredPropertyCandidate {
  const {
    candidate,
    resolvedCheckIn,
    resolvedCheckOut,
    emailGuest,
    hasConfirmationCode,
    emailConfirmationCode,
  } = input;

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

  const normalizedStrength = guestNameMatchStrength(emailGuest, candidate.guestName);
  let guestScore = 0;
  if (normalizedStrength >= MIN_NORMALIZED_GUEST_SCORE) {
    guestScore = normalizedStrength;
  } else if (emailGuest?.trim() && isPlaceholderGuestName(candidate.guestName)) {
    guestScore = 0.55;
  }

  const hmMatch = resolveHmMatch(emailConfirmationCode, candidate.reservationCode);

  let confidence = 0.52 + dateOverlap * 0.28 + guestScore * 0.18;
  if (hasConfirmationCode) confidence += 0.04;
  if (hmMatch) confidence += 0.06;
  if (candidate.icalUid) confidence += 0.03;
  confidence = Math.min(confidence, 0.97);

  return {
    candidate,
    dateOverlap,
    overlapDays,
    guestScore,
    confidence,
    hmMatch,
  };
}

function collectRejectedBecause(input: {
  row: ScoredPropertyCandidate;
  hasGuestSignal: boolean;
}): string[] {
  const reasons: string[] = [];
  const { row, hasGuestSignal } = input;

  if (row.confidence < MIN_AUTO_LINK_CONFIDENCE) {
    reasons.push("confidence_below_threshold");
  }
  if (row.dateOverlap < MIN_DATE_OVERLAP_FOR_SAFE) {
    reasons.push("dateOverlap_below_threshold");
  }
  if (hasGuestSignal && row.guestScore < MIN_NORMALIZED_GUEST_SCORE) {
    reasons.push("guestScore_below_threshold");
  }
  if (!hasGuestSignal && row.guestScore > 0 && row.guestScore < MIN_NORMALIZED_GUEST_SCORE) {
    reasons.push("guestScore_insufficient_without_strong_dates");
  }

  return reasons;
}

function isSafeAutoLinkCandidate(
  row: ScoredPropertyCandidate,
  hasGuestSignal: boolean,
): boolean {
  return collectRejectedBecause({ row, hasGuestSignal }).length === 0;
}

function filterSafeAutoLinkCandidates(input: {
  scored: ScoredPropertyCandidate[];
  hasGuestSignal: boolean;
}): ScoredPropertyCandidate[] {
  return input.scored.filter((row) =>
    isSafeAutoLinkCandidate(row, input.hasGuestSignal),
  );
}

function logCandidateEvaluationFailed(
  propertyId: string,
  row: ScoredPropertyCandidate,
  emailGuestName: string | null | undefined,
  rejectedBecause: string[],
  extraReason?: string,
): void {
  const reasons = [...rejectedBecause];
  if (extraReason) reasons.push(extraReason);

  airbnbEmailLog.info("candidate_evaluation_failed", {
    propertyId,
    reservationId: row.candidate.id,
    guestNameFromReservation: row.candidate.guestName,
    guestNameFromEmail: emailGuestName ?? undefined,
    guestNameFromEmailNormalized: normalizeGuestName(emailGuestName) || undefined,
    guestNameFromReservationNormalized:
      normalizeGuestName(row.candidate.guestName) || undefined,
    guestScore: Number(row.guestScore.toFixed(3)),
    dateOverlap: Number(row.dateOverlap.toFixed(3)),
    overlapDays: row.overlapDays,
    hmMatch: row.hmMatch,
    confidence: Number(row.confidence.toFixed(3)),
    rejectedBecause: reasons.join(","),
  });
  airbnbEmailLog.info("reservation_candidate_filtered", {
    propertyId,
    reservationId: row.candidate.id,
    filteredBecause: reasons.join(","),
  });

  if (rejectedBecause.includes("guestScore_below_threshold")) {
    airbnbEmailLog.info("candidate_rejected_guest", {
      propertyId,
      reservationId: row.candidate.id,
      guestScore: row.guestScore,
    });
  }
  if (rejectedBecause.includes("dateOverlap_below_threshold")) {
    airbnbEmailLog.info("candidate_rejected_overlap", {
      propertyId,
      reservationId: row.candidate.id,
      dateOverlap: row.dateOverlap,
      overlapDays: row.overlapDays,
    });
  }
}

function logAllFailedCandidates(
  propertyId: string,
  scored: ScoredPropertyCandidate[],
  hasGuestSignal: boolean,
  selectedId: string | null,
  extraReasonById?: Map<string, string>,
  emailGuestName?: string | null,
): void {
  for (const row of scored) {
    if (row.candidate.id === selectedId) continue;
    const rejectedBecause = collectRejectedBecause({ row, hasGuestSignal });
    logCandidateEvaluationFailed(
      propertyId,
      row,
      emailGuestName,
      rejectedBecause,
      extraReasonById?.get(row.candidate.id),
    );
  }
}

function detectMultiplePlaceholderCandidates(
  propertyId: string,
  scored: ScoredPropertyCandidate[],
  emailGuestName: string | null | undefined,
): boolean {
  const overlappingPlaceholders = scored.filter(
    (row) =>
      isPlaceholderGuestName(row.candidate.guestName) &&
      row.dateOverlap >= MIN_DATE_OVERLAP_FOR_SAFE,
  );

  if (overlappingPlaceholders.length < 2) return false;

  airbnbEmailLog.warn("multiple_placeholder_candidates_detected", {
    propertyId,
    candidateCount: overlappingPlaceholders.length,
    reservationIds: overlappingPlaceholders.map((r) => r.candidate.id).join(","),
    overlapsJson: JSON.stringify(
      overlappingPlaceholders.map((r) => ({
        reservationId: r.candidate.id,
        dateOverlap: r.dateOverlap,
        overlapDays: r.overlapDays,
        guestScore: r.guestScore,
        checkIn: r.candidate.checkIn.toISOString(),
        checkOut: r.candidate.checkOut.toISOString(),
      })),
    ),
    guestNameFromEmail: emailGuestName ?? undefined,
  });

  return true;
}

function logSuccessfulVsFailedMatchComparison(input: {
  propertyId: string;
  scored: ScoredPropertyCandidate[];
  safeCandidates: ScoredPropertyCandidate[];
  narrowedCount: number;
  hasGuestName: boolean;
  emailGuestName: string | null | undefined;
}): void {
  const best = [...input.scored].sort((a, b) => b.confidence - a.confidence)[0];
  const bestSafe = input.safeCandidates[0];

  airbnbEmailLog.info("successful_vs_failed_match_comparison", {
    propertyId: input.propertyId,
    outcome: input.safeCandidates.length === 1 ? "would_auto_link" : "no_safe_auto_link",
    narrowedCount: input.narrowedCount,
    hasGuestName: input.hasGuestName,
    safeCandidateCount: input.safeCandidates.length,
    bestReservationId: best?.candidate.id,
    bestConfidence: best ? Number(best.confidence.toFixed(3)) : undefined,
    bestDateOverlap: best?.dateOverlap,
    bestGuestScore: best?.guestScore,
    bestHmMatch: best?.hmMatch,
    bestGuestNormalizedMatch: best
      ? guestNameMatches(input.emailGuestName, best.candidate.guestName)
      : undefined,
    bestSafeReservationId: bestSafe?.candidate.id,
    bestSafeConfidence: bestSafe ? Number(bestSafe.confidence.toFixed(3)) : undefined,
    placeholderOverlapCount: input.scored.filter(
      (r) =>
        isPlaceholderGuestName(r.candidate.guestName) &&
        r.dateOverlap >= MIN_DATE_OVERLAP_FOR_SAFE,
    ).length,
  });
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
  airbnbEmailLog.info("candidate_safe_match_found", {
    propertyId: input.propertyId,
    reservationId: selected.id,
    confidence: scored.confidence,
    decisiveSignal: input.decisiveSignal,
    selectedReason: scored.selectedReason ?? input.decisiveSignal,
    guestScore: scored.guestScore,
    dateOverlap: scored.dateOverlap,
    overlapDays: scored.overlapDays,
    hmMatch: scored.hmMatch,
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
      scored.dateOverlap >= MIN_DATE_OVERLAP_FOR_SAFE
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
  airbnbEmailLog.info("reservation_placeholder_scan_started", {
    propertyId: input.propertyId,
    organizationId: input.organizationId,
  });
  const debugReservations = await scanPropertyReservationsForDebug({
    propertyId: input.propertyId,
    organizationId: input.organizationId,
  });
  airbnbEmailLog.info("reservation_placeholder_scan_result", {
    propertyId: input.propertyId,
    reservationCount: debugReservations.length,
    reservations:
      debugReservations.length > 0
        ? JSON.stringify(
            debugReservations.map((r) => ({
              reservationId: r.id,
              status: r.status,
              source: "unknown",
              guestName: r.guestName,
              checkIn: r.checkIn.toISOString(),
              checkOut: r.checkOut.toISOString(),
              createdAt: r.createdAt.toISOString(),
            })),
          )
        : "[]",
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
  const candidateIds = new Set(candidates.map((c) => c.id));
  for (const reservation of debugReservations) {
    if (candidateIds.has(reservation.id)) continue;
    const filteredBecause: string[] = [];
    if (reservation.status === ReservationStatus.CANCELLED) {
      filteredBecause.push("status_not_allowed");
    }
    if (filteredBecause.length === 0) {
      filteredBecause.push("filtered_by_visibility_or_window");
    }
    airbnbEmailLog.info("reservation_candidate_filtered", {
      propertyId: input.propertyId,
      reservationId: reservation.id,
      filteredBecause: filteredBecause.join(","),
    });
  }

  if (candidates.length === 0) {
    if (debugReservations.length === 0) {
      airbnbEmailLog.warn("email_arrived_before_placeholder_exists", {
        propertyId: input.propertyId,
        organizationId: input.organizationId,
        reason: "no_reservations_on_property_at_match_time",
      });
    }
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
      emailConfirmationCode: input.signals.confirmationCode,
    }),
  );

  for (const row of scored) {
    airbnbEmailLog.info("reservation_candidate_score", {
      propertyId: input.propertyId,
      reservationId: row.candidate.id,
      guestNameFromReservation: row.candidate.guestName,
      guestNameFromEmail: input.signals.guestName ?? undefined,
      checkIn: row.candidate.checkIn.toISOString(),
      checkOut: row.candidate.checkOut.toISOString(),
      dateOverlap: row.dateOverlap,
      overlapDays: row.overlapDays,
      guestScore: row.guestScore,
      hmMatch: row.hmMatch,
      confidence: Number(row.confidence.toFixed(3)),
    });
  }

  const hasMultiplePlaceholders = detectMultiplePlaceholderCandidates(
    input.propertyId,
    scored,
    input.signals.guestName,
  );

  const narrowed = narrowContextualCandidates(
    candidates,
    input.signals,
    resolvedDates.checkIn,
    resolvedDates.checkOut,
  );

  const safeCandidates = filterSafeAutoLinkCandidates({
    scored,
    hasGuestSignal: hasGuestName,
  });

  if (hasMultiplePlaceholders) {
    airbnbEmailLog.info("candidate_rejected_multiple", {
      propertyId: input.propertyId,
      reason: "multiple_placeholder_candidates_detected",
      safeCandidateCount: safeCandidates.length,
    });
    logAllFailedCandidates(
      input.propertyId,
      scored,
      hasGuestName,
      null,
      undefined,
      input.signals.guestName,
    );
    logSuccessfulVsFailedMatchComparison({
      propertyId: input.propertyId,
      scored,
      safeCandidates: [],
      narrowedCount: narrowed.length,
      hasGuestName,
      emailGuestName: input.signals.guestName,
    });
    airbnbEmailLog.warn("property_reservation_match_rejected", {
      propertyId: input.propertyId,
      reason: "no_unique_safe_candidate",
      subReason: "multiple_placeholder_candidates_detected",
    });
    return null;
  }

  const tryAutoLink = (winner: ScoredPropertyCandidate, decisiveSignal: string) => {
    logReconciliationInputSnapshot({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      signals: input.signals,
      normalizedListing: input.signals.listingName
        ? normalizeGuestName(input.signals.listingName)
        : null,
      scored,
      selectedReservationId: winner.candidate.id,
    });
    winner.selectedReason = decisiveSignal;
    logAllFailedCandidates(
      input.propertyId,
      scored,
      hasGuestName,
      winner.candidate.id,
      undefined,
      input.signals.guestName,
    );
    return buildPropertyScopedMatch(winner.candidate, winner, {
      propertyId: input.propertyId,
      decisiveSignal,
      hasConfirmationCode,
      emailGuestName: input.signals.guestName,
    });
  };

  if (narrowed.length === 1) {
    const selected = narrowed[0]!;
    const row =
      scored.find((s) => s.candidate.id === selected.id) ??
      scorePropertyReservationCandidate({
        candidate: { ...selected, reservationCode: null },
        resolvedCheckIn: resolvedDates.checkIn,
        resolvedCheckOut: resolvedDates.checkOut,
        emailGuest: input.signals.guestName,
        hasConfirmationCode,
        emailConfirmationCode: input.signals.confirmationCode,
      });

    if (isSafeAutoLinkCandidate(row, hasGuestName)) {
      return tryAutoLink(row, "property_narrow:unique_safe_candidate");
    }

    const rejectedBecause = collectRejectedBecause({ row, hasGuestSignal: hasGuestName });
    logCandidateEvaluationFailed(
      input.propertyId,
      row,
      input.signals.guestName,
      rejectedBecause,
      "narrow_single_winner_not_safe",
    );
  }

  if (safeCandidates.length > 1) {
    logReconciliationInputSnapshot({
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      signals: input.signals,
      normalizedListing: input.signals.listingName
        ? normalizeGuestName(input.signals.listingName)
        : null,
      scored,
      selectedReservationId: null,
    });
    airbnbEmailLog.warn("auto_link_rejected_multiple_candidates", {
      propertyId: input.propertyId,
      candidateCount: safeCandidates.length,
      reason: "multiple_similar_candidates",
    });
    airbnbEmailLog.info("candidate_rejected_multiple", {
      propertyId: input.propertyId,
      reservationIds: safeCandidates.map((c) => c.candidate.id).join(","),
      reason: "multiple_safe_candidates",
    });
    for (const row of safeCandidates) {
      logCandidateEvaluationFailed(
        input.propertyId,
        row,
        input.signals.guestName,
        ["multiple_safe_candidates"],
        undefined,
      );
    }
    logSuccessfulVsFailedMatchComparison({
      propertyId: input.propertyId,
      scored,
      safeCandidates,
      narrowedCount: narrowed.length,
      hasGuestName,
      emailGuestName: input.signals.guestName,
    });
    return null;
  }

  if (safeCandidates.length === 1) {
    airbnbEmailLog.info("auto_link_allowed_unique_candidate", {
      propertyId: input.propertyId,
      reservationId: safeCandidates[0]!.candidate.id,
      candidateCount: 1,
      reason: "unique_safe_candidate",
    });
    return tryAutoLink(safeCandidates[0]!, "property_scored:unique_safe_candidate");
  }

  logAllFailedCandidates(
    input.propertyId,
    scored,
    hasGuestName,
    null,
    undefined,
    input.signals.guestName,
  );
  for (const row of scored) {
    const filteredBecause = collectRejectedBecause({
      row,
      hasGuestSignal: hasGuestName,
    });
    if (filteredBecause.length === 0) continue;
    airbnbEmailLog.info("reservation_candidate_filtered", {
      propertyId: input.propertyId,
      reservationId: row.candidate.id,
      filteredBecause: filteredBecause.join(","),
    });
  }
  logSuccessfulVsFailedMatchComparison({
    propertyId: input.propertyId,
    scored,
    safeCandidates,
    narrowedCount: narrowed.length,
    hasGuestName,
    emailGuestName: input.signals.guestName,
  });

  airbnbEmailLog.warn("property_reservation_match_rejected", {
    propertyId: input.propertyId,
    reason: "no_unique_safe_candidate",
    candidateCount: candidates.length,
    narrowedCount: narrowed.length,
    hasGuestName,
    hasResolvedCheckIn: Boolean(resolvedDates.checkIn),
  });
  logReconciliationInputSnapshot({
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    signals: input.signals,
    normalizedListing: input.signals.listingName
      ? normalizeGuestName(input.signals.listingName)
      : null,
    scored,
    selectedReservationId: null,
  });

  return null;
}
