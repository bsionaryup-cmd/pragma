/**
 * Conservative guest-name comparison for matching (display layer uses separate helpers).
 */

export function normalizeGuestName(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function nameTokens(value: string): string[] {
  return normalizeGuestName(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/**
 * 0 = no match, ~0.85 = strong partial (first name / accent variant), 1 = full reasonable match.
 */
export function guestNameMatchStrength(
  emailGuest: string | null | undefined,
  reservationGuest: string | null | undefined,
): number {
  const emailNorm = normalizeGuestName(emailGuest);
  const reservationNorm = normalizeGuestName(reservationGuest);
  if (!emailNorm || !reservationNorm) return 0;

  if (emailNorm === reservationNorm) return 1;

  const emailTokens = nameTokens(emailGuest ?? "");
  const reservationTokens = nameTokens(reservationGuest ?? "");
  if (emailTokens.length === 0 || reservationTokens.length === 0) return 0;

  const emailFirst = emailTokens[0]!;
  const reservationFirst = reservationTokens[0]!;

  if (emailFirst !== reservationFirst) return 0;

  const emailRest = emailTokens.slice(1);
  const reservationRest = reservationTokens.slice(1);

  if (emailRest.length === 0 || reservationRest.length === 0) {
    return 0.85;
  }

  const sharedRest = emailRest.filter((token) => reservationRest.includes(token));
  if (sharedRest.length === 0) {
    return 0;
  }

  const allEmailInReservation = emailTokens.every((token) =>
    reservationNorm.includes(token),
  );
  const allReservationInEmail = reservationTokens.every((token) =>
    emailNorm.includes(token),
  );

  if (allEmailInReservation || allReservationInEmail) return 1;

  return 0.85;
}

export function guestNamesEquivalent(
  emailGuest: string | null | undefined,
  reservationGuest: string | null | undefined,
): boolean {
  return guestNameMatchStrength(emailGuest, reservationGuest) >= 0.85;
}
