import { reservationHoldMinDepositRatio } from "@/lib/reservations/reservation-hold";

export function formatHoldExpiryLabel(
  holdExpiresAt: string | Date | null | undefined,
): string | null {
  if (!holdExpiresAt) return null;
  const expires =
    holdExpiresAt instanceof Date ? holdExpiresAt : new Date(holdExpiresAt);
  if (Number.isNaN(expires.getTime())) return null;

  const ms = expires.getTime() - Date.now();
  if (ms <= 0) return "Hold expirado";

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Expira en ${days} día${days === 1 ? "" : "s"}`;
  }
  if (hours > 0) {
    return `Expira en ${hours}h ${minutes}m`;
  }
  return `Expira en ${minutes} min`;
}

export function holdDepositPercentLabel(): string {
  const pct = Math.round(reservationHoldMinDepositRatio() * 100);
  return `${pct}%`;
}
