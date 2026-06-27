import { type BookingPlatform, type ReservationStatus } from "@prisma/client";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";

export function buildIcalSyncReservationUpdate(
  payload: {
    guestName: string;
    guestFirstName: string;
    guestLastName: string | null;
    checkIn: Date;
    checkOut: Date;
    status: ReservationStatus;
    platform: BookingPlatform;
  },
  existing: {
    guestName: string;
    guestRegistrationCompletedAt: Date | null;
  },
) {
  if (existing.guestRegistrationCompletedAt) {
    return {
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      status: payload.status,
      platform: payload.platform,
    };
  }

  const preserveEnrichedGuestName = !isPlaceholderGuestName(existing.guestName);

  return {
    ...(preserveEnrichedGuestName
      ? {}
      : {
          guestName: payload.guestName,
          guestFirstName: payload.guestFirstName,
          guestLastName: payload.guestLastName,
        }),
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    status: payload.status,
    platform: payload.platform,
  };
}
