export function normalizeConfirmationCode(
  code: string | null | undefined,
): string | null {
  const trimmed = code?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

/** True when email and reservation both have codes that differ (hard reject for matching). */
export function confirmationCodesConflict(
  emailCode: string | null | undefined,
  reservationCode: string | null | undefined,
): boolean {
  const email = normalizeConfirmationCode(emailCode);
  const existing = normalizeConfirmationCode(reservationCode);
  if (!email || !existing) return false;
  return email !== existing;
}
