export const CONFIRMED_SUBJECT_MARKERS = [
  "reserva confirmada",
  "booking confirmed",
  "is confirmed",
  "confirmed reservation",
] as const;

export function subjectLooksLikeConfirmedReservation(
  subject: string | null | undefined,
): boolean {
  const normalized = (subject ?? "").toLowerCase();
  return CONFIRMED_SUBJECT_MARKERS.some((needle) => normalized.includes(needle));
}
