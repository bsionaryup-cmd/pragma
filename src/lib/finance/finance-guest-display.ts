import type { BookingPlatform } from "@prisma/client";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import {
  mergeReservationRevenueSources,
  type ReservationRevenueSources,
} from "@/lib/finance/reservation-revenue-amount";

export function resolveFinanceGuestDisplayName(
  input: {
    platform: BookingPlatform;
    guestName: string;
    guestRegistrationCompletedAt?: Date | null;
  },
  sources?: ReservationRevenueSources | null,
): string {
  const merged = sources ? mergeReservationRevenueSources(sources) : {};
  const enrichedGuest =
    typeof merged.guestName === "string" ? merged.guestName.trim() : null;

  return resolveReservationDisplayGuestName({
    platform: input.platform,
    guestName: input.guestName,
    guestRegistrationCompletedAt: input.guestRegistrationCompletedAt,
    airbnbGuestName: enrichedGuest,
    airbnbEnrichmentGuestName: enrichedGuest,
  });
}
