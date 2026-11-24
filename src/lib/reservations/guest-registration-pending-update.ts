/** Pure helpers for manual occupancy → GR pending-update UI (no server-only). */

export function isGuestRegistrationPendingUpdate(input: {
  guestRegistrationCompletedAt: Date | string | null | undefined;
  registered: number;
  capacity: number;
}): boolean {
  if (input.guestRegistrationCompletedAt) return false;
  return input.registered > 0 && input.registered < input.capacity;
}
