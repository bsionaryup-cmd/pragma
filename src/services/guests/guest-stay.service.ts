import "server-only";

import {
  GuestRegistrationStatus,
  ReservationGuestStatus,
  ReservationStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/app-url";

export type GuestStayLookupState =
  | "invalid"
  | "registration_pending"
  | "valid";

export type GuestStayView = {
  token: string;
  reservationCode: string | null;
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  propertyName: string;
  unitNumber: string | null;
  address: string;
  city: string;
  neighborhood: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string | null;
  accessInstructions: string | null;
  contactWhatsapp: string | null;
  guestRegistrationCompleted: boolean;
  registeredGuestCount: number;
  guestNames: string[];
};

export type GuestStayLookupResult =
  | { state: "invalid" }
  | { state: "registration_pending"; registrationUrl: string }
  | { state: "valid"; stay: GuestStayView };

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildGuestStayUrl(token: string): string {
  return `${getPublicAppUrl()}/stay/${encodeURIComponent(token)}`;
}

/**
 * Private stay hub keyed by the same unguessable registration token.
 * Never accepts reservationCode alone — prevents enumeration of other stays.
 */
export async function getGuestStayByToken(
  token: string,
): Promise<GuestStayLookupResult> {
  const raw = token?.trim();
  if (!raw || raw.length < 16) {
    return { state: "invalid" };
  }

  const registration = await db.guestRegistrationToken.findUnique({
    where: { token: raw },
    select: {
      token: true,
      status: true,
      reservationId: true,
    },
  });

  if (!registration) {
    return { state: "invalid" };
  }

  if (
    registration.status === GuestRegistrationStatus.REVOKED ||
    registration.status === GuestRegistrationStatus.EXPIRED
  ) {
    return { state: "invalid" };
  }

  if (registration.status === GuestRegistrationStatus.ACTIVE) {
    return {
      state: "registration_pending",
      registrationUrl: `${getPublicAppUrl()}/guest-registration/${encodeURIComponent(raw)}`,
    };
  }

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      reservationCode: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          address: true,
          city: true,
          neighborhood: true,
          checkInTime: true,
          checkOutTime: true,
          houseRules: true,
          accessInstructions: true,
          receptionWhatsapp: true,
        },
      },
      guests: {
        where: {
          status: {
            in: [
              ReservationGuestStatus.REGISTERED,
              ReservationGuestStatus.VERIFIED,
              ReservationGuestStatus.CHECKED_IN,
              ReservationGuestStatus.CHECKED_OUT,
            ],
          },
        },
        orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
        select: { fullName: true },
      },
    },
  });

  if (!reservation) {
    return { state: "invalid" };
  }

  const property = reservation.property;

  return {
    state: "valid",
    stay: {
      token: raw,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      checkIn: formatDateOnly(reservation.checkIn),
      checkOut: formatDateOnly(reservation.checkOut),
      propertyName: property.name,
      unitNumber: property.unitNumber,
      address: property.address,
      city: property.city,
      neighborhood: property.neighborhood,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      houseRules: property.houseRules,
      accessInstructions: property.accessInstructions,
      contactWhatsapp: property.receptionWhatsapp,
      guestRegistrationCompleted: Boolean(
        reservation.guestRegistrationCompletedAt,
      ),
      registeredGuestCount: reservation.guests.length,
      guestNames: reservation.guests.map((g) => g.fullName),
    },
  };
}
