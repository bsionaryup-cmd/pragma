import {
  BookingPlatform,
  GuestRegistrationStatus,
  ReservationStatus,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { guestRegistrationSchema } from "@/features/guests/schemas/guest-registration.schema";
import type { GuestRegistrationValues } from "@/features/guests/schemas/guest-registration.schema";
import { getPublicAppUrl } from "@/lib/app-url";
import { prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";

export type GuestRegistrationReservation = {
  id: string;
  token: string;
  status: GuestRegistrationStatus;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  guests: {
    id: string;
    isPrimary: boolean;
    firstName: string;
    lastName: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    email: string | null;
    phone: string | null;
  }[];
};

export type GuestRegistrationLookupResult =
  | { state: "valid"; reservation: GuestRegistrationReservation }
  | { state: "completed" }
  | { state: "revoked" }
  | { state: "invalid" };

export function getReservationGuestCount(input: {
  adults: number;
  children: number;
  infants: number;
}): number {
  return Math.max(1, input.adults + input.children + input.infants);
}

export function buildGuestRegistrationUrl(token: string): string {
  return `${getPublicAppUrl()}/guest-registration/${encodeURIComponent(token)}`;
}

export async function ensureGuestRegistrationForReservation(
  reservationId: string,
): Promise<string | null> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      platform: true,
      status: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationToken: true,
    },
  });

  if (!reservation) return null;
  const guestCount = getReservationGuestCount(reservation);
  const eligible =
    reservation.platform === BookingPlatform.AIRBNB &&
    reservation.status === ReservationStatus.CONFIRMED &&
    guestCount > 0;

  if (!eligible) return null;
  const activeToken = await db.guestRegistrationToken.findFirst({
    where: {
      reservationId: reservation.id,
      status: GuestRegistrationStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeToken) {
    return buildGuestRegistrationUrl(activeToken.token);
  }

  const token = randomBytes(24).toString("hex");
  await db.$transaction([
    db.guestRegistrationToken.create({
      data: {
        reservationId: reservation.id,
        token,
        expiresAt: null,
        createdBySystem: true,
      },
    }),
    db.reservation.update({
      where: { id: reservation.id },
      data: { guestRegistrationToken: token },
    }),
  ]);

  return buildGuestRegistrationUrl(token);
}

export async function regenerateGuestRegistrationToken(
  reservationId: string,
): Promise<string> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true },
  });
  if (!reservation) throw new Error("Reserva no encontrada");

  const token = randomBytes(24).toString("hex");
  await db.$transaction([
    db.guestRegistrationToken.updateMany({
      where: {
        reservationId,
        status: GuestRegistrationStatus.ACTIVE,
      },
      data: {
        status: GuestRegistrationStatus.REVOKED,
        revokedAt: new Date(),
      },
    }),
    db.guestRegistrationToken.create({
      data: {
        reservationId,
        token,
        expiresAt: null,
        createdBySystem: true,
      },
    }),
    db.reservation.update({
      where: { id: reservationId },
      data: { guestRegistrationToken: token },
    }),
  ]);

  return buildGuestRegistrationUrl(token);
}

export async function revokeGuestRegistrationToken(
  reservationId: string,
): Promise<void> {
  await db.$transaction([
    db.guestRegistrationToken.updateMany({
      where: {
        reservationId,
        status: GuestRegistrationStatus.ACTIVE,
      },
      data: {
        status: GuestRegistrationStatus.REVOKED,
        revokedAt: new Date(),
      },
    }),
    db.reservation.update({
      where: { id: reservationId },
      data: { guestRegistrationToken: null },
    }),
  ]);
}

export async function getActiveGuestRegistrationForReservation(
  reservationId: string,
) {
  const token = await db.guestRegistrationToken.findFirst({
    where: {
      reservationId,
      status: { in: [GuestRegistrationStatus.ACTIVE, GuestRegistrationStatus.COMPLETED] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!token) return null;
  return {
    id: token.id,
    token: token.token,
    status: token.status,
    url: buildGuestRegistrationUrl(token.token),
    createdAt: token.createdAt.toISOString(),
    expiresAt: token.expiresAt?.toISOString() ?? null,
    usedAt: token.usedAt?.toISOString() ?? null,
  };
}

export async function getGuestRegistrationByToken(
  token: string,
): Promise<GuestRegistrationReservation | null> {
  const result = await getGuestRegistrationLookupResult(token);
  return result.state === "valid" ? result.reservation : null;
}

export async function getGuestRegistrationLookupResult(
  token: string,
): Promise<GuestRegistrationLookupResult> {
  const registration = await db.guestRegistrationToken.findUnique({
    where: { token },
    select: {
      id: true,
      reservationId: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      usedAt: true,
    },
  });

  if (!registration) return { state: "invalid" };
  if (registration.status === GuestRegistrationStatus.COMPLETED) {
    return { state: "completed" };
  }
  if (registration.status === GuestRegistrationStatus.REVOKED) {
    return { state: "revoked" };
  }
  if (registration.status === GuestRegistrationStatus.EXPIRED) {
    return { state: "invalid" };
  }

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      infants: true,
      property: { select: { name: true } },
    },
  });
  if (!reservation) return { state: "invalid" };

  const guests = await db.reservationGuest.findMany({
    where: { reservationId: reservation.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });


  return {
    state: "valid",
    reservation: {
      id: reservation.id,
      token,
      status: registration.status,
      propertyName: reservation.property.name,
      checkIn: prismaDateToKey(reservation.checkIn),
      checkOut: prismaDateToKey(reservation.checkOut),
      guestCount: getReservationGuestCount(reservation),
      createdAt: registration.createdAt.toISOString(),
      expiresAt: registration.expiresAt?.toISOString() ?? null,
      completedAt: registration.usedAt?.toISOString() ?? null,
      guests,
    },
  };
}

export async function submitGuestRegistration(
  values: GuestRegistrationValues,
): Promise<void> {
  const parsed = guestRegistrationSchema.parse(values);
  const registration = await db.guestRegistrationToken.findUnique({
    where: { token: parsed.token },
    select: {
      id: true,
      reservationId: true,
      status: true,
      attempts: true,
      maxAttempts: true,
    },
  });

  if (!registration) throw new Error("Registro no encontrado");
  if (registration.status !== GuestRegistrationStatus.ACTIVE) {
    throw new Error("Este enlace de registro ya no está activo");
  }
  if (registration.attempts >= registration.maxAttempts) {
    throw new Error("Se alcanzó el máximo de intentos para este enlace");
  }

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      adults: true,
      children: true,
      infants: true,
    },
  });

  if (!reservation) throw new Error("Reserva no encontrada");

  const expectedCount = getReservationGuestCount(reservation);
  if (parsed.guests.length !== expectedCount) {
    throw new Error(`Debes registrar exactamente ${expectedCount} huésped(es).`);
  }

  const primary = parsed.guests[0];
  const primaryFullName = `${primary.firstName.trim()} ${primary.lastName.trim()}`;

  await db.$transaction(async (tx) => {
    await tx.reservationGuest.deleteMany({
      where: { reservationId: reservation.id },
    });

    await tx.reservationGuest.createMany({
      data: parsed.guests.map((guest, index) => ({
        reservationId: reservation.id,
        isPrimary: index === 0,
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim(),
        fullName: `${guest.firstName.trim()} ${guest.lastName.trim()}`,
        documentType: guest.documentType,
        documentNumber: guest.documentNumber.trim(),
        email: index === 0 ? guest.email?.trim() || null : null,
        phone: index === 0 ? guest.phone?.trim() || null : null,
      })),
    });

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        guestName: primaryFullName,
        guestFirstName: primary.firstName.trim(),
        guestLastName: primary.lastName.trim(),
        guestEmail: primary.email?.trim() || null,
        guestPhone: primary.phone?.trim() || null,
        guestRegistrationCompletedAt: new Date(),
      },
    });

    await tx.guestRegistrationToken.update({
      where: { id: registration.id },
      data: {
        status: GuestRegistrationStatus.COMPLETED,
        usedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  });
}
