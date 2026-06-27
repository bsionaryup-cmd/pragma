/** Human-readable capacity label for calendar property rows. */
export function formatPropertyCapacityLabel(maxGuests: number | null | undefined): string {
  if (maxGuests == null || !Number.isFinite(maxGuests) || maxGuests < 1) return "";
  return `× ${maxGuests}`;
}
