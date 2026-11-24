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

export type IcalSyncReservationRow = {
  checkIn: Date;
  checkOut: Date;
  status: ReservationStatus;
  guestName: string;
  guestFirstName: string;
  guestLastName: string | null;
  guestRegistrationCompletedAt: Date | null;
  platform: BookingPlatform;
};

export type IcalSyncReservationUpdate = ReturnType<
  typeof buildIcalSyncReservationUpdate
>;

/**
 * Split iCal updates so guestName writes can be applied with a DB guard
 * (`guestRegistrationCompletedAt IS NULL`) — closes TOCTOU vs Guest Registration.
 */
export function splitIcalSyncUpdateForSafePersist(
  update: IcalSyncReservationUpdate,
): {
  always: Omit<
    IcalSyncReservationUpdate,
    "guestName" | "guestFirstName" | "guestLastName"
  > &
    Partial<
      Pick<
        IcalSyncReservationUpdate,
        "guestName" | "guestFirstName" | "guestLastName"
      >
    >;
  guestNameOnlyIfUnlocked: {
    guestName: string;
    guestFirstName: string;
    guestLastName: string | null;
  } | null;
} {
  if (!("guestName" in update) || update.guestName === undefined) {
    return { always: update, guestNameOnlyIfUnlocked: null };
  }

  const {
    guestName,
    guestFirstName = guestName.split(/\s+/)[0] ?? guestName,
    guestLastName = null,
    ...always
  } = update;

  return {
    always,
    guestNameOnlyIfUnlocked: {
      guestName,
      guestFirstName,
      guestLastName,
    },
  };
}

/** True when applying `update` would leave the reservation row unchanged. */
export function reservationMatchesIcalSyncUpdate(
  existing: IcalSyncReservationRow,
  update: ReturnType<typeof buildIcalSyncReservationUpdate>,
): boolean {
  if (existing.checkIn.getTime() !== update.checkIn.getTime()) return false;
  if (existing.checkOut.getTime() !== update.checkOut.getTime()) return false;
  if (existing.status !== update.status) return false;
  if (existing.platform !== update.platform) return false;

  if ("guestName" in update && update.guestName !== undefined) {
    if (existing.guestName !== update.guestName) return false;
    if (
      update.guestFirstName !== undefined &&
      existing.guestFirstName !== update.guestFirstName
    ) {
      return false;
    }
    if (
      update.guestLastName !== undefined &&
      existing.guestLastName !== update.guestLastName
    ) {
      return false;
    }
  }

  return true;
}
