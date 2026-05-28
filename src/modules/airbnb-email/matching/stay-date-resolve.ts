/** Stay-date helpers for property-scoped reservation linking (matcher layer only). */

export const PROPERTY_DATE_SLACK_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type StayDateCandidate = {
  checkIn: Date;
  checkOut: Date;
};

export function checkInWithinSlack(
  candidateCheckIn: Date,
  emailCheckIn: Date,
  slackDays = PROPERTY_DATE_SLACK_DAYS,
): boolean {
  const diff = Math.abs(candidateCheckIn.getTime() - emailCheckIn.getTime());
  return diff <= slackDays * DAY_MS;
}

export function stayDatesOverlap(
  candidate: StayDateCandidate,
  emailCheckIn: Date | null,
  emailCheckOut: Date | null,
  slackDays = PROPERTY_DATE_SLACK_DAYS,
): boolean {
  if (!emailCheckIn) return false;
  if (emailCheckOut) {
    return (
      candidate.checkIn < emailCheckOut && candidate.checkOut > emailCheckIn
    );
  }
  return checkInWithinSlack(candidate.checkIn, emailCheckIn, slackDays);
}

export function inferStayDatesFromPropertyCandidates(
  parsedCheckIn: Date | null,
  parsedCheckOut: Date | null,
  candidates: StayDateCandidate[],
): {
  checkIn: Date | null;
  checkOut: Date | null;
  inferredCheckOutFromIcal: boolean;
} {
  if (parsedCheckIn && parsedCheckOut) {
    return {
      checkIn: parsedCheckIn,
      checkOut: parsedCheckOut,
      inferredCheckOutFromIcal: false,
    };
  }

  if (!parsedCheckIn) {
    return {
      checkIn: null,
      checkOut: parsedCheckOut,
      inferredCheckOutFromIcal: false,
    };
  }

  const aligned = candidates.filter((c) =>
    checkInWithinSlack(c.checkIn, parsedCheckIn),
  );
  if (aligned.length === 1) {
    return {
      checkIn: parsedCheckIn,
      checkOut: parsedCheckOut ?? aligned[0]!.checkOut,
      inferredCheckOutFromIcal: !parsedCheckOut,
    };
  }

  return {
    checkIn: parsedCheckIn,
    checkOut: parsedCheckOut,
    inferredCheckOutFromIcal: false,
  };
}

export function inferYearFromPropertyCandidates(
  day: number,
  month: number,
  candidates: StayDateCandidate[],
): number | null {
  const aligned = candidates.filter((c) => {
    const d = c.checkIn;
    return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });
  if (aligned.length === 1) {
    return aligned[0]!.checkIn.getUTCFullYear();
  }
  if (aligned.length > 1) {
    const years = [...new Set(aligned.map((c) => c.checkIn.getUTCFullYear()))];
    if (years.length === 1) return years[0]!;
  }
  return null;
}
