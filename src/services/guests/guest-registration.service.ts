import {
  BookingPlatform,
  GuestRegistrationStatus,
  ReservationGuestStatus,
  ReservationStatus,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import {
  completeGuestRegistrationSchema,
  guestRegistrationSchema,
  guestStepSchema,
} from "@/features/guests/schemas/guest-registration.schema";
import type {
  CompleteGuestRegistrationValues,
  GuestRegistrationValues,
  GuestStepValues,
} from "@/features/guests/schemas/guest-registration.schema";
import { getPublicAppUrl } from "@/lib/app-url";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatPropertyLabel } from "@/lib/property-display";
import { isValidPhoneNumber } from "@/lib/phone/phone-number";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { onGuestRegistrationCompletedForTTLock } from "@/services/integrations/ttlock/ttlock-reservation.hooks";
import {
  getGuestRegistrationMaxCapacity,
  getReservationGuestCount,
  type GuestRegistrationCapacityInput,
} from "@/lib/guest-registration/guest-registration-capacity";
import { getAirbnbEnrichedGuestCountsByReservationIds } from "@/services/reservations/airbnb-display-guest-count.service";

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

const GUEST_REGISTRATION_ELIGIBLE_PLATFORMS: BookingPlatform[] = [
  BookingPlatform.AIRBNB,
  BookingPlatform.DIRECT,
];

export function isGuestRegistrationEligiblePlatform(
  platform: BookingPlatform,
): boolean {
  return GUEST_REGISTRATION_ELIGIBLE_PLATFORMS.includes(platform);
}

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
  if (!isGuestRegistrationEligiblePlatform(reservation.platform)) {
    throw new GuestRegistrationError(
      "El registro de huéspedes no está disponible para este tipo de reserva.",
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

export type GuestRegistrationGuest = {
  id: string;
  isPrimary: boolean;
  isReservationOwner: boolean;
  status: ReservationGuestStatus;
  firstName: string;
  lastName: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
};

export type GuestRegistrationReservation = {
  id: string;
  token: string;
  status: GuestRegistrationStatus;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  maxCapacity: number;
  registeredCount: number;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  guests: GuestRegistrationGuest[];
};

export type GuestRegistrationLookupResult =
  | { state: "valid"; reservation: GuestRegistrationReservation }
  | { state: "completed" }
  | { state: "revoked" }
  | { state: "invalid" };

export { getGuestRegistrationMaxCapacity, getReservationGuestCount };

async function resolveGuestRegistrationMaxCapacity(
  reservation: GuestRegistrationCapacityInput & { id: string },
  registeredCount?: number,
): Promise<number> {
  let guestCountTotal: number | null = null;
  let enrichedAdultCount: number | null = null;
  let enrichedChildCount: number | null = null;
  if (reservation.platform === BookingPlatform.AIRBNB) {
    const enrichment = await getAirbnbEnrichedGuestCountsByReservationIds([
      reservation.id,
    ]);
    const counts = enrichment.get(reservation.id);
    guestCountTotal = counts?.guestCountTotal ?? null;
    enrichedAdultCount = counts?.adultCount ?? null;
    enrichedChildCount = counts?.childCount ?? null;
  }

  return getGuestRegistrationMaxCapacity({
    ...reservation,
    guestCountTotal,
    enrichedAdultCount,
    enrichedChildCount,
    registeredCount,
  });
}

function mapGuestRecord(
  guest: {
    id: string;
    isPrimary: boolean;
    isReservationOwner: boolean;
    status: ReservationGuestStatus;
    firstName: string;
    lastName: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    dateOfBirth: Date | null;
  },
): GuestRegistrationGuest {
  return {
    id: guest.id,
    isPrimary: guest.isPrimary,
    isReservationOwner: guest.isReservationOwner,
    status: guest.status,
    firstName: guest.firstName,
    lastName: guest.lastName,
    fullName: guest.fullName,
    documentType: guest.documentType,
    documentNumber: guest.documentNumber,
    email: guest.email,
    phone: guest.phone,
    nationality: guest.nationality,
    dateOfBirth: guest.dateOfBirth
      ? prismaDateToKey(guest.dateOfBirth)
      : null,
  };
}

function parseOptionalDateOfBirth(value: string | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return dateKeyToPrismaDate(trimmed);
}

async function countRegisteredGuests(reservationId: string): Promise<number> {
  return db.reservationGuest.count({
    where: {
      reservationId,
      status: {
        in: [
          ReservationGuestStatus.REGISTERED,
          ReservationGuestStatus.VERIFIED,
          ReservationGuestStatus.CHECKED_IN,
          ReservationGuestStatus.CHECKED_OUT,
        ],
      },
    },
  });
}

async function buildGuestRegistrationReservationView(input: {
  token: string;
  registration: {
    status: GuestRegistrationStatus;
    createdAt: Date;
    expiresAt: Date | null;
    usedAt: Date | null;
  };
  reservation: {
    id: string;
    platform: BookingPlatform;
    checkIn: Date;
    checkOut: Date;
    adults: number;
    children: number;
    infants: number;
    guestRegistrationCompletedAt: Date | null;
    property: { name: string; unitNumber?: string | null; maxGuests: number };
  };
  guests: Parameters<typeof mapGuestRecord>[0][];
}): Promise<GuestRegistrationReservation> {
  const mappedGuests = input.guests.map(mapGuestRecord);
  const registeredCount = mappedGuests.filter(
    (guest) => guest.status !== ReservationGuestStatus.PENDING_REGISTRATION,
  ).length;
  const maxCapacity = await resolveGuestRegistrationMaxCapacity(
    {
      id: input.reservation.id,
      platform: input.reservation.platform,
      adults: input.reservation.adults,
      children: input.reservation.children,
      infants: input.reservation.infants,
      propertyMaxGuests: input.reservation.property.maxGuests,
      guestRegistrationCompletedAt: input.reservation.guestRegistrationCompletedAt,
    },
    registeredCount,
  );

  return {
    id: input.reservation.id,
    token: input.token,
    status: input.registration.status,
    propertyName: formatPropertyLabel(input.reservation.property),
    checkIn: prismaDateToKey(input.reservation.checkIn),
    checkOut: prismaDateToKey(input.reservation.checkOut),
    guestCount: getReservationGuestCount(input.reservation),
    maxCapacity,
    registeredCount,
    createdAt: input.registration.createdAt.toISOString(),
    expiresAt: input.registration.expiresAt?.toISOString() ?? null,
    completedAt: input.registration.usedAt?.toISOString() ?? null,
    guests: mappedGuests,
  };
}

async function finalizeGuestRegistration(
  registrationId: string,
  reservationId: string,
): Promise<void> {
  const guests = await db.reservationGuest.findMany({
    where: { reservationId },
    orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
  });

  const owner =
    guests.find((guest) => guest.isReservationOwner) ??
    guests.find((guest) => guest.isPrimary) ??
    guests[0];

  if (!owner) {
    throw new GuestRegistrationError(
      "Debes registrar al menos un huésped antes de finalizar.",
    );
  }

  const registeredCount = guests.filter(
    (guest) => guest.status !== ReservationGuestStatus.PENDING_REGISTRATION,
  ).length;

  await db.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        guestName: owner.fullName,
        guestFirstName: owner.firstName,
        guestLastName: owner.lastName,
        guestEmail: owner.email,
        guestPhone: owner.phone,
        adults: Math.max(1, registeredCount),
        guestRegistrationCompletedAt: new Date(),
      },
    });

    await tx.guestRegistrationToken.update({
      where: { id: registrationId },
      data: {
        status: GuestRegistrationStatus.COMPLETED,
        usedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  });

  const accessContext = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      propertyId: true,
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
      platform: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: { select: { name: true, unitNumber: true, maxGuests: true } },
    },
  });
  if (!reservation) return { state: "invalid" };

  const guests = await db.reservationGuest.findMany({
    where: { reservationId: reservation.id },
    orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
  });

  const reservationView = await buildGuestRegistrationReservationView({
    token,
    registration,
    reservation,
    guests,
  });

  return {
    state: "valid",
    reservation: reservationView,
  };
}

export async function registerGuestStep(
  values: GuestStepValues,
): Promise<GuestRegistrationReservation> {
  const parsed = guestStepSchema.parse(values);
  const registration = await db.guestRegistrationToken.findUnique({
    where: { token: parsed.token },
    select: {
      id: true,
      reservationId: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!registration) {
    throw new GuestRegistrationError("Registro no encontrado");
  }
  if (registration.status !== GuestRegistrationStatus.ACTIVE) {
    throw new GuestRegistrationError("Este enlace de registro ya no está activo");
  }

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      platform: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: { select: { name: true, unitNumber: true, maxGuests: true } },
    },
  });

  if (!reservation) {
    throw new GuestRegistrationError("Reserva no encontrada");
  }
  if (reservation.guestRegistrationCompletedAt) {
    throw new GuestRegistrationError("El registro ya fue completado");
  }

  const registeredCount = await countRegisteredGuests(reservation.id);
  const maxCapacity = await resolveGuestRegistrationMaxCapacity(
    {
      id: reservation.id,
      platform: reservation.platform,
      adults: reservation.adults,
      children: reservation.children,
      infants: reservation.infants,
      propertyMaxGuests: reservation.property.maxGuests,
      guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
    },
    registeredCount,
  );

  if (registeredCount >= maxCapacity) {
    throw new GuestRegistrationError(
      "No puedes registrar más huéspedes de los permitidos en esta reserva.",
    );
  }

  const isOwner = registeredCount === 0;
  if (isOwner) {
    if (!parsed.email?.trim()) {
      throw new GuestRegistrationError("Email requerido para el titular de la reserva");
    }
    if (!parsed.phone?.trim() || !isValidPhoneNumber(parsed.phone)) {
      throw new GuestRegistrationError(
        "Teléfono inválido. Selecciona el código de país.",
      );
    }
  }

  const documentNumber = parsed.documentNumber.trim();
  const duplicate = await db.reservationGuest.findFirst({
    where: {
      reservationId: reservation.id,
      documentNumber,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new GuestRegistrationError("Este documento ya fue registrado en la reserva");
  }

  const firstName = parsed.firstName.trim();
  const lastName = parsed.lastName.trim();
  const fullName = `${firstName} ${lastName}`;

  await db.$transaction(async (tx) => {
    await tx.reservationGuest.create({
      data: {
        reservationId: reservation.id,
        isPrimary: isOwner,
        isReservationOwner: isOwner,
        status: ReservationGuestStatus.REGISTERED,
        firstName,
        lastName,
        fullName,
        documentType: parsed.documentType,
        documentNumber,
        email: parsed.email?.trim() || null,
        phone: parsed.phone?.trim() || null,
        nationality: parsed.nationality?.trim() || null,
        dateOfBirth: parseOptionalDateOfBirth(parsed.dateOfBirth),
      },
    });

    if (isOwner) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          guestName: fullName,
          guestFirstName: firstName,
          guestLastName: lastName,
          guestEmail: parsed.email?.trim() || null,
          guestPhone: parsed.phone?.trim() || null,
        },
      });
    }
  });

  const guests = await db.reservationGuest.findMany({
    where: { reservationId: reservation.id },
    orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
  });

  return buildGuestRegistrationReservationView({
    token: parsed.token,
    registration,
    reservation,
    guests,
  });
}

export async function completeGuestRegistration(
  values: CompleteGuestRegistrationValues,
): Promise<GuestRegistrationReservation> {
  const parsed = completeGuestRegistrationSchema.parse(values);
  const registration = await db.guestRegistrationToken.findUnique({
    where: { token: parsed.token },
    select: {
      id: true,
      reservationId: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!registration) {
    throw new GuestRegistrationError("Registro no encontrado");
  }
  if (registration.status !== GuestRegistrationStatus.ACTIVE) {
    throw new GuestRegistrationError("Este enlace de registro ya no está activo");
  }

  const registeredCount = await countRegisteredGuests(registration.reservationId);
  if (registeredCount < 1) {
    throw new GuestRegistrationError(
      "Registra al menos un huésped antes de finalizar.",
    );
  }

  const ownerCount = await db.reservationGuest.count({
    where: {
      reservationId: registration.reservationId,
      isReservationOwner: true,
    },
  });
  if (ownerCount !== 1) {
    throw new GuestRegistrationError(
      "Debe existir un titular de la reserva registrado.",
    );
  }

  await finalizeGuestRegistration(registration.id, registration.reservationId);

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      platform: true,
      checkIn: true,
      checkOut: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: { select: { name: true, unitNumber: true, maxGuests: true } },
    },
  });
  if (!reservation) {
    throw new GuestRegistrationError("Reserva no encontrada");
  }

  const guests = await db.reservationGuest.findMany({
    where: { reservationId: reservation.id },
    orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
  });

  return buildGuestRegistrationReservationView({
    token: parsed.token,
    registration: {
      ...registration,
      status: GuestRegistrationStatus.COMPLETED,
      usedAt: new Date(),
    },
    reservation,
    guests,
  });
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

  if (!registration) throw new GuestRegistrationError("Registro no encontrado");
  if (registration.status !== GuestRegistrationStatus.ACTIVE) {
    throw new GuestRegistrationError("Este enlace de registro ya no está activo");
  }
  if (registration.attempts >= registration.maxAttempts) {
    throw new GuestRegistrationError("Se alcanzó el máximo de intentos para este enlace");
  }

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      platform: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: { select: { maxGuests: true } },
    },
  });

  if (!reservation) throw new GuestRegistrationError("Reserva no encontrada");

  const maxCapacity = await resolveGuestRegistrationMaxCapacity({
    id: reservation.id,
    platform: reservation.platform,
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    propertyMaxGuests: reservation.property.maxGuests,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
  });
  if (parsed.guests.length > maxCapacity) {
    throw new GuestRegistrationError(
      "No puedes registrar más huéspedes de los permitidos en esta reserva.",
    );
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
        isReservationOwner: index === 0,
        status: ReservationGuestStatus.REGISTERED,
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim(),
        fullName: `${guest.firstName.trim()} ${guest.lastName.trim()}`,
        documentType: guest.documentType,
        documentNumber: guest.documentNumber.trim(),
        email: guest.email?.trim() || null,
        phone: guest.phone?.trim() || null,
        nationality: guest.nationality?.trim() || null,
        dateOfBirth: parseOptionalDateOfBirth(guest.dateOfBirth),
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
        adults: Math.max(1, parsed.guests.length),
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
