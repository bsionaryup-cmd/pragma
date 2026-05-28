import {
  BookingPlatform,
  ReservationStatus,
  AirbnbEmailMatchMethod,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { guestNamesEquivalent } from "@/modules/airbnb-email/matching/guest-name-normalize";
import { checkInWithinSlack } from "@/modules/airbnb-email/matching/stay-date-resolve";
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
  return guestNamesEquivalent(emailGuest, reservationGuest);
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
  const now = new Date();
  const startsInDays = Math.round(
    (input.candidate.checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const proximityBonus =
    startsInDays <= 3 ? 0.14 : startsInDays <= 14 ? 0.09 : startsInDays <= 45 ? 0.05 : 0;

  let score = 0.58 + proximityBonus;
  if (input.hasConfirmationCode) score += 0.04; // metadata signal only
  if (input.candidate.icalUid) score += 0.04;
  if (
    guestNameMatches(input.guestName, input.candidate.guestName) &&
    !isPlaceholderGuestName(input.candidate.guestName)
  ) {
    score += 0.2;
  } else if (
    input.guestName?.trim() &&
    isPlaceholderGuestName(input.candidate.guestName)
  ) {
    score += 0.1;
  }
  if (
    datesOverlap(
      input.candidate.checkIn,
      input.candidate.checkOut,
      input.parsedCheckIn,
      input.parsedCheckOut,
    )
  ) {
    score += 0.08;
  }
  return Math.min(score, 0.95);
}

async function loadContextualCandidates(input: {
  organizationId: string;
  propertyId?: string | null;
}): Promise<ContextualCandidate[]> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 1);
  const windowEnd = new Date(now);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 120);

  const rows = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
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

  if (parsedCheckIn && !parsedCheckOut) {
    const byCheckInSlack = candidates.filter((c) =>
      checkInWithinSlack(c.checkIn, parsedCheckIn),
    );
    if (byCheckInSlack.length === 1) return byCheckInSlack;
    if (byCheckInSlack.length > 1) {
      const byGuest = byCheckInSlack.filter((c) =>
        guestNameMatches(signals.guestName, c.guestName),
      );
      if (byGuest.length === 1) return byGuest;
      if (
        byGuest.length === 0 &&
        signals.guestName?.trim() &&
        byCheckInSlack.every((c) => isPlaceholderGuestName(c.guestName))
      ) {
        return [];
      }
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
  propertyId?: string | null;
  organizationId: string;
  signals: ExtractedReservationSignals;
  parsedCheckIn: Date | null;
  parsedCheckOut: Date | null;
}): Promise<ContextualMatchBase | null> {
  const hasConfirmationCode = Boolean(input.signals.confirmationCode?.trim());

  airbnbEmailLog.info("ical_context_match_started", {
    organizationId: input.organizationId,
    propertyId: input.propertyId ?? undefined,
    hasGuestName: Boolean(input.signals.guestName),
    hasParsedDates: Boolean(input.parsedCheckIn && input.parsedCheckOut),
    hasConfirmationCode,
    guestName: input.signals.guestName ?? undefined,
  });

  if (!input.propertyId && !input.signals.guestName?.trim()) {
    airbnbEmailLog.warn("ical_context_skipped", {
      organizationId: input.organizationId,
      reason: "missing_guest_name_for_tenant_wide_match",
    });
    return null;
  }

  const candidates = await loadContextualCandidates({
    propertyId: input.propertyId ?? null,
    organizationId: input.organizationId,
  });

  airbnbEmailLog.info("contextual_match_candidate", {
    propertyId: input.propertyId ?? undefined,
    candidateCount: candidates.length,
    hasParsedDates: Boolean(input.parsedCheckIn && input.parsedCheckOut),
    hasGuestName: Boolean(input.signals.guestName),
    confirmationCode: input.signals.confirmationCode ?? undefined,
  });

  const narrowed = narrowContextualCandidates(
    candidates,
    input.signals,
    input.parsedCheckIn,
    input.parsedCheckOut,
  );
  if (narrowed.length === 1) {
    const selected = narrowed[0]!;
    const guestNameMatch = guestNameMatches(
      input.signals.guestName,
      selected.guestName,
    );
    const dateOverlapSelected = Boolean(
      input.parsedCheckIn &&
        input.parsedCheckOut &&
        datesOverlap(
          selected.checkIn,
          selected.checkOut,
          input.parsedCheckIn,
          input.parsedCheckOut,
        ),
    );
    let confidence = 0.85;
    if (guestNameMatch) confidence += 0.08;
    else if (
      input.signals.guestName?.trim() &&
      isPlaceholderGuestName(selected.guestName)
    ) {
      confidence += 0.05;
    }
    if (dateOverlapSelected) confidence += 0.06;
    if (hasConfirmationCode) confidence += 0.04;
    if (input.propertyId && selected.propertyId === input.propertyId) {
      confidence += 0.04;
    }
    confidence = Math.min(confidence, 0.96);

    const decisiveSignal = guestNameMatch
      ? dateOverlapSelected
        ? "narrow:guestName+dates"
        : "narrow:guestName"
      : dateOverlapSelected
        ? "narrow:dates"
        : input.propertyId
          ? "narrow:property_single"
          : "narrow:single_candidate";

    airbnbEmailLog.info("ical_context_selected", {
      propertyId: input.propertyId ?? undefined,
      reservationId: selected.id,
      confidence,
      guestNameMatch,
      dateOverlap: dateOverlapSelected,
      hasConfirmationCode,
      decisiveSignal,
      reason: decisiveSignal,
    });

    airbnbEmailLog.info("contextual_match_selected", {
      propertyId: input.propertyId ?? undefined,
      reservationId: selected.id,
      confidence,
      hasIcalUid: Boolean(selected.icalUid),
      usedParsedDates: dateOverlapSelected,
      guestNameSignal: guestNameMatch,
      branch: "narrow_contextual",
    });

    return {
      reservationId: selected.id,
      propertyId: selected.propertyId,
      organizationId: selected.organizationId,
      method: AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH,
      confidence,
    };
  }

  if (candidates.length === 0) {
    airbnbEmailLog.info("ical_context_candidates", {
      propertyId: input.propertyId ?? undefined,
      candidateCount: 0,
      hasGuestName: Boolean(input.signals.guestName),
      hasParsedDates: Boolean(input.parsedCheckIn && input.parsedCheckOut),
      hasConfirmationCode,
    });
    airbnbEmailLog.info("contextual_match_rejected", {
      propertyId: input.propertyId ?? undefined,
      reason: "no_active_ical_candidates",
    });
    airbnbEmailLog.warn("ical_context_rejected", {
      propertyId: input.propertyId ?? undefined,
      reason: "no_candidates",
    });
    return null;
  }

  airbnbEmailLog.info("contextual_candidate_found", {
    propertyId: input.propertyId ?? undefined,
    candidateCount: candidates.length,
    reservationIds: candidates.map((c) => c.id).join(","),
  });
  const evaluated = candidates.map((candidate) => {
    const guestMatch = guestNameMatches(input.signals.guestName, candidate.guestName);
    const dateOverlap = datesOverlap(
      candidate.checkIn,
      candidate.checkOut,
      input.parsedCheckIn,
      input.parsedCheckOut,
    );
    const confidenceRaw = scoreContextualCandidate({
      candidate,
      hasConfirmationCode,
      guestName: input.signals.guestName,
      parsedCheckIn: input.parsedCheckIn,
      parsedCheckOut: input.parsedCheckOut,
    });
    const propertySignal =
      Boolean(input.propertyId) && candidate.propertyId === input.propertyId;
    const confidence = Math.min(
      confidenceRaw + (propertySignal ? 0.06 : 0),
      0.97,
    );
    return { candidate, guestMatch, dateOverlap, confidence, propertySignal };
  });

  airbnbEmailLog.info("ical_context_candidates", {
    propertyId: input.propertyId ?? undefined,
    candidateCount: evaluated.length,
    hasGuestName: Boolean(input.signals.guestName),
    hasParsedDates: Boolean(input.parsedCheckIn && input.parsedCheckOut),
    hasConfirmationCode,
    candidates: evaluated
      .map(
        (row) =>
          `${row.candidate.id}:${row.confidence.toFixed(2)}:guest=${row.guestMatch ? 1 : 0}:dates=${row.dateOverlap ? 1 : 0}:property=${row.propertySignal ? 1 : 0}`,
      )
      .join("|"),
  });

  const ranked = [...evaluated].sort((a, b) => b.confidence - a.confidence);

  airbnbEmailLog.info("candidate_score_breakdown", {
    propertyId: input.propertyId ?? undefined,
    ranked: ranked
      .slice(0, 5)
      .map(
        (row) =>
          `${row.candidate.id}:${row.confidence.toFixed(3)}:guest=${row.guestMatch ? 1 : 0}:dates=${row.dateOverlap ? 1 : 0}`,
      )
      .join("|"),
  });
  const top = ranked[0]!;
  const second = ranked[1] ?? null;
  if (!top || top.confidence < 0.8) {
    airbnbEmailLog.warn("contextual_match_rejected", {
      propertyId: input.propertyId ?? undefined,
      reason: "low_context_confidence",
      topConfidence: top?.confidence ?? 0,
    });
    airbnbEmailLog.warn("ical_context_rejected", {
      propertyId: input.propertyId ?? undefined,
      reason: "low_confidence",
      topConfidence: top?.confidence ?? 0,
      candidateCount: ranked.length,
    });
    return null;
  }

  if (second && top.confidence - second.confidence < 0.1) {
    airbnbEmailLog.warn("ical_context_ambiguous", {
      propertyId: input.propertyId ?? undefined,
      topReservationId: top.candidate.id,
      secondReservationId: second.candidate.id,
      topConfidence: top.confidence,
      secondConfidence: second.confidence,
      reason: "confidence_too_close",
    });
    return null;
  }

  const selected = top.candidate;
  const confidence = top.confidence;

  if (confidence < 0.84) {
    airbnbEmailLog.warn("contextual_match_rejected", {
      propertyId: input.propertyId ?? undefined,
      reservationId: selected.id,
      reason: "confidence_below_threshold",
      confidence,
    });
    airbnbEmailLog.warn("ical_context_rejected", {
      propertyId: input.propertyId ?? undefined,
      reservationId: selected.id,
      reason: "confidence_below_threshold",
      confidence,
    });
    return null;
  }

  const guestNameMatch = guestNameMatches(
    input.signals.guestName,
    selected.guestName,
  );
  const dateOverlapSelected = Boolean(
    input.parsedCheckIn &&
      input.parsedCheckOut &&
      datesOverlap(
        selected.checkIn,
        selected.checkOut,
        input.parsedCheckIn,
        input.parsedCheckOut,
      ),
  );
  const decisiveSignal = guestNameMatch
    ? dateOverlapSelected
      ? "guestName+dates+ical"
      : "guestName+ical"
    : dateOverlapSelected
      ? "dates+ical"
      : "ical_proximity";

  airbnbEmailLog.info("ical_context_selected", {
    propertyId: input.propertyId ?? undefined,
    reservationId: selected.id,
    confidence,
    guestNameMatch,
    dateOverlap: dateOverlapSelected,
    hasConfirmationCode,
    decisiveSignal,
    reason: decisiveSignal,
  });

  airbnbEmailLog.info("contextual_match_selected", {
    propertyId: input.propertyId ?? undefined,
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
    method: AirbnbEmailMatchMethod.ICAL_CONTEXTUAL_MATCH,
    confidence,
  };
}
