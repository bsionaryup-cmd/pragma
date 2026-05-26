/**
 * Reserva directa con pago pendiente: bloqueo temporal hasta depósito o expiración.
 */
const DEFAULT_HOLD_HOURS = 24;
const DEFAULT_MIN_DEPOSIT_RATIO = 0.5;

export function reservationHoldDurationMs(): number {
  const raw = process.env.RESERVATION_HOLD_HOURS;
  const hours = raw ? Number.parseFloat(raw) : DEFAULT_HOLD_HOURS;
  const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_HOLD_HOURS;
  return safe * 60 * 60 * 1000;
}

export function reservationHoldMinDepositRatio(): number {
  const raw = process.env.RESERVATION_HOLD_MIN_DEPOSIT_PERCENT;
  if (!raw) return DEFAULT_MIN_DEPOSIT_RATIO;
  const pct = Number.parseFloat(raw);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 1) return DEFAULT_MIN_DEPOSIT_RATIO;
  return pct;
}

export function computeHoldExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + reservationHoldDurationMs());
}

export function getHoldMinimumAmount(totalAmount: number): number {
  return Math.round(totalAmount * reservationHoldMinDepositRatio() * 100) / 100;
}

export function hasSatisfiedHoldDeposit(
  paidAmount: number,
  totalAmount: number,
): boolean {
  if (totalAmount <= 0) return true;
  return paidAmount + 0.009 >= getHoldMinimumAmount(totalAmount);
}

export function isReservationHoldActive(input: {
  holdExpiresAt: Date | string | null | undefined;
  paymentStatus?: string | null;
}): boolean {
  if (!input.holdExpiresAt) return false;
  const expires =
    input.holdExpiresAt instanceof Date
      ? input.holdExpiresAt
      : new Date(input.holdExpiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  if (expires.getTime() <= Date.now()) return false;
  return input.paymentStatus === "PENDING" || input.paymentStatus === "PARTIAL";
}
