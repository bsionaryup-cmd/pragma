/** Días de trial restantes (redondeo hacia arriba). */
export function computeTrialDaysRemaining(
  trialEndsAt: string | Date | null | undefined,
): number {
  if (!trialEndsAt) return 0;
  const end = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
