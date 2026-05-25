import { totalGuests } from "@/features/reservations/lib/reservation-dates";

export function guestCapacityMessage(maxGuests: number): string {
  return `Máximo ${maxGuests} huésped${maxGuests === 1 ? "" : "es"} (capacidad de la propiedad)`;
}

export function resolvePropertyMaxGuests(
  maxGuests: number | undefined | null,
): number | null {
  if (maxGuests == null || !Number.isFinite(maxGuests) || maxGuests < 1) {
    return null;
  }
  return Math.floor(maxGuests);
}

export function guestTotalExceedsCapacity(
  adults: number,
  children: number,
  infants: number,
  maxGuests: number | null,
): boolean {
  if (maxGuests == null) return false;
  return totalGuests(adults, children, infants) > maxGuests;
}

/** Ajusta conteos para no superar la capacidad (prioriza mantener al menos 1 adulto). */
export function clampGuestsToCapacity(
  adults: number,
  children: number,
  infants: number,
  maxGuests: number,
): { adults: number; children: number; infants: number } {
  let a = Math.max(1, Math.floor(adults) || 1);
  let c = Math.max(0, Math.floor(children) || 0);
  let i = Math.max(0, Math.floor(infants) || 0);

  while (totalGuests(a, c, i) > maxGuests) {
    if (i > 0) i -= 1;
    else if (c > 0) c -= 1;
    else if (a > 1) a -= 1;
    else break;
  }

  return { adults: a, children: c, infants: i };
}
