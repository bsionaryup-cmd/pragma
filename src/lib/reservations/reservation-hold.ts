/**
 * Reserva directa con pago pendiente: bloqueo temporal hasta depósito o expiración.
 */
const DEFAULT_HOLD_MINUTES = 30;
const DEFAULT_MIN_DEPOSIT_RATIO = 0.5;

export function reservationHoldDurationMs(): number {
  const rawMinutes = process.env.RESERVATION_HOLD_MINUTES;
  if (rawMinutes) {
    const minutes = Number.parseFloat(rawMinutes);
    if (Number.isFinite(minutes) && minutes > 0) {
      return minutes * 60 * 1000;
    }
  }

  const rawHours = process.env.RESERVATION_HOLD_HOURS;
  if (rawHours) {
    const hours = Number.parseFloat(rawHours);
    if (Number.isFinite(hours) && hours > 0) {
      return hours * 60 * 60 * 1000;
    }
  }

  return DEFAULT_HOLD_MINUTES * 60 * 1000;
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
