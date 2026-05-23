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
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { onGuestRegistrationCompletedForTTLock } from "@/services/integrations/ttlock/ttlock-reservation.hooks";

export class GuestRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestRegistrationError";
  }
}

const GUEST_REGISTRATION_ELIGIBLE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
];

export function isGuestRegistrationEligibleStatus(
  status: ReservationStatus,
): boolean {
  return GUEST_REGISTRATION_ELIGIBLE_STATUSES.includes(status);
}

type GuestRegistrationReservationSnapshot = {
  platform: BookingPlatform;
  status: ReservationStatus;
  adults: number;
  children: number;
  infants: number;
  guestRegistrationCompletedAt: Date | null;
};

function assertGuestRegistrationEligible(
  reservation: GuestRegistrationReservationSnapshot,
): void {
  if (reservation.platform !== BookingPlatform.AIRBNB) {
    throw new GuestRegistrationError(
      "El registro de huéspedes solo aplica a reservas de Airbnb.",
    );
  }

  if (
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.BLOCKED
  ) {
    throw new GuestRegistrationError(
      "No se puede generar link para reservas canceladas o bloqueadas.",
    );
  }

  if (!GUEST_REGISTRATION_ELIGIBLE_STATUSES.includes(reservation.status)) {
    throw new GuestRegistrationError(
      "Esta reserva ya finalizó; no se puede generar un nuevo link de registro.",
    );
  }

  if (reservation.guestRegistrationCompletedAt) {
    throw new GuestRegistrationError(
      "El registro ya fue completado por el huésped.",
    );
  }

  if (getReservationGuestCount(reservation) <= 0) {
    throw new GuestRegistrationError(
      "La reserva no tiene huéspedes configurados.",
    );
  }
}

async function loadGuestRegistrationReservation(
  reservationId: string,
): Promise<GuestRegistrationReservationSnapshot> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      platform: true,
      status: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
    },
  });

  if (!reservation) {
    throw new GuestRegistrationError("Reserva no encontrada");
  }

  return reservation;
}

async function createGuestRegistrationTokenRecord(
  reservationId: string,
): Promise<string> {
  const token = randomBytes(24).toString("hex");

  await db.$transaction([
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

  return token;
}

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
      guestRegistrationCompletedAt: true,
    },
  });

  if (!reservation) return null;
  try {
    assertGuestRegistrationEligible(reservation);
  } catch {
    return null;
  }

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

  const token = await createGuestRegistrationTokenRecord(reservation.id);
  return buildGuestRegistrationUrl(token);
}

export async function generateGuestRegistrationLink(
  reservationId: string,
): Promise<string> {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

  const reservation = await loadGuestRegistrationReservation(reservationId);
  assertGuestRegistrationEligible(reservation);

  const activeToken = await db.guestRegistrationToken.findFirst({
    where: {
      reservationId,
      status: GuestRegistrationStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeToken) {
    return buildGuestRegistrationUrl(activeToken.token);
  }

  const token = await createGuestRegistrationTokenRecord(reservationId);
  return buildGuestRegistrationUrl(token);
}

export async function regenerateGuestRegistrationToken(
  reservationId: string,
): Promise<string> {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

  const reservation = await loadGuestRegistrationReservation(reservationId);
  assertGuestRegistrationEligible(reservation);

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
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

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

  const accessContext = await db.reservation.findUnique({
    where: { id: reservation.id },
    select: {
      id: true,
      propertyId: true,
      checkIn: true,
      checkOut: true,
      property: { select: { ownerId: true } },
    },
  });

  if (accessContext?.property) {
    await onGuestRegistrationCompletedForTTLock({
      reservationId: accessContext.id,
      propertyId: accessContext.propertyId,
      ownerId: accessContext.property.ownerId,
      guestRegistrationCompleted: true,
    });
  }
}
