import { ReservationStatus } from "@prisma/client";

const POST_STAY_RESERVATION_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
]);

/** Evita tarjetas de cancelación por emails mal clasificados en estadías ya activas. */
export function isCancellationFeedEligible(
  status: ReservationStatus | null | undefined,
): boolean {
  if (!status) return true;
  if (status === ReservationStatus.CANCELLED) return true;
  return !POST_STAY_RESERVATION_STATUSES.has(status);
}

/** Solo aplicar cancelación automática antes de check-in. */
export function shouldApplyEmailCancellation(
  status: ReservationStatus,
): boolean {
  return (
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.BLOCKED
  );
}
