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
import {
  isValidPhoneNumber,
  normalizePhoneForStorage,
} from "@/lib/phone/phone-number";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import {
  getGuestRegistrationMaxCapacity,
  getReservationGuestCount,
  type GuestRegistrationCapacityInput,
} from "@/lib/guest-registration/guest-registration-capacity";
import {
  reconcileReservationOccupancyIfSafe,
  resolveGuestRegistrationMaxCapacityForReservation,
} from "@/lib/guest-registration/guest-registration-occupancy-reconcile";
import {
  GUEST_HABEAS_DATA_POLICY_VERSION,
  GUEST_HABEAS_DATA_SUMMARY_ES,
  GUEST_LEGAL_LOCALE_DEFAULT,
  GUEST_LODGING_CONTRACT_SUMMARY_ES,
  GUEST_LODGING_CONTRACT_VERSION,
} from "@/lib/guest-registration/guest-legal-versions";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import type { GuestRegistrationRequestMeta } from "@/features/guests/schemas/guest-registration.schema";

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
  sex: string | null;
  travelMotive: string | null;
  occupation: string | null;
  residenceCountry: string | null;
  residenceAdminArea: string | null;
  residenceCity: string | null;
  originCountry: string | null;
  originAdminArea: string | null;
  originCity: string | null;
  destinationCountry: string | null;
  destinationAdminArea: string | null;
  destinationCity: string | null;
};

export type GuestRegistrationReservation = {
  id: string;
  token: string;
  status: GuestRegistrationStatus;
  /** Public-safe reservation holder label for the guest-facing header. */
  holderDisplayName: string | null;
  /** Airbnb confirmation code when platform is AIRBNB; otherwise null. */
  reservationCode: string | null;
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
  return resolveGuestRegistrationMaxCapacityForReservation({
    id: reservation.id,
    platform: reservation.platform,
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    propertyMaxGuests: reservation.propertyMaxGuests,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
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
    sex: string | null;
    travelMotive: string | null;
    occupation: string | null;
    residenceCountry: string | null;
    residenceAdminArea: string | null;
    residenceCity: string | null;
    originCountry: string | null;
    originAdminArea: string | null;
    originCity: string | null;
    destinationCountry: string | null;
    destinationAdminArea: string | null;
    destinationCity: string | null;
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
    sex: guest.sex,
    travelMotive: guest.travelMotive,
    occupation: guest.occupation,
    residenceCountry: guest.residenceCountry,
    residenceAdminArea: guest.residenceAdminArea,
    residenceCity: guest.residenceCity,
    originCountry: guest.originCountry,
    originAdminArea: guest.originAdminArea,
    originCity: guest.originCity,
    destinationCountry: guest.destinationCountry,
    destinationAdminArea: guest.destinationAdminArea,
    destinationCity: guest.destinationCity,
  };
}

function buildCanonicalGuestWriteData(parsed: {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  travelMotive: string;
  occupation: string;
  residenceCountry: string;
  residenceAdminArea: string;
  residenceCity: string;
  originCountry: string;
  originAdminArea: string;
  originCity: string;
  destinationCountry: string;
  destinationAdminArea: string;
  destinationCity: string;
}) {
  const firstName = parsed.firstName.trim();
  const lastName = parsed.lastName.trim();
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    documentType: parsed.documentType,
    documentNumber: parsed.documentNumber.trim(),
    email: parsed.email?.trim() || null,
    phone: normalizePhoneForStorage(parsed.phone),
    nationality: parsed.nationality.trim(),
    dateOfBirth: parseOptionalDateOfBirth(parsed.dateOfBirth),
    sex: parsed.sex,
    travelMotive: parsed.travelMotive,
    occupation: parsed.occupation.trim(),
    residenceCountry: parsed.residenceCountry.trim(),
    residenceAdminArea: parsed.residenceAdminArea.trim(),
    residenceCity: parsed.residenceCity.trim(),
    originCountry: parsed.originCountry.trim(),
    originAdminArea: parsed.originAdminArea.trim(),
    originCity: parsed.originCity.trim(),
    destinationCountry: parsed.destinationCountry.trim(),
    destinationAdminArea: parsed.destinationAdminArea.trim(),
    destinationCity: parsed.destinationCity.trim(),
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
    guestName: string | null;
    reservationCode: string | null;
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

  const ownerGuest =
    mappedGuests.find((guest) => guest.isReservationOwner) ??
    mappedGuests.find((guest) => guest.isPrimary) ??
    null;
  const ownerName = ownerGuest?.fullName?.trim() || null;
  const reservationGuestName = input.reservation.guestName?.trim() || null;
  const holderDisplayName =
    ownerName ||
    (reservationGuestName &&
    !isPlaceholderGuestName(reservationGuestName) &&
    isPlausibleGuestName(reservationGuestName)
      ? reservationGuestName
      : null);

  return {
    id: input.reservation.id,
    token: input.token,
    status: input.registration.status,
    holderDisplayName,
    reservationCode:
      input.reservation.platform === BookingPlatform.AIRBNB
        ? input.reservation.reservationCode?.trim().toUpperCase() || null
        : null,
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
  legal: {
    locale: string;
    requestMeta: GuestRegistrationRequestMeta;
  },
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

  const reservationMeta = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      propertyId: true,
      property: { select: { organizationId: true, ownerId: true } },
    },
  });

  if (!reservationMeta) {
    throw new GuestRegistrationError("Reserva no encontrada");
  }

  const acceptedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        guestName: owner.fullName,
        guestFirstName: owner.firstName,
        guestLastName: owner.lastName,
        guestEmail: owner.email,
        guestPhone: owner.phone,
        guestCountry: owner.nationality,
        guestRegistrationCompletedAt: acceptedAt,
      },
    });

    await tx.guestRegistrationToken.update({
      where: { id: registrationId },
      data: {
        status: GuestRegistrationStatus.COMPLETED,
        usedAt: acceptedAt,
        attempts: { increment: 1 },
      },
    });

    await tx.guestRegistrationLegalAcceptance.upsert({
      where: { reservationId },
      create: {
        reservationId,
        organizationId: reservationMeta.property.organizationId,
        propertyId: reservationMeta.propertyId,
        acceptedByGuestId: owner.id,
        titularFullName: owner.fullName,
        titularDocumentType: owner.documentType,
        titularDocumentNumber: owner.documentNumber,
        lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
        lodgingContractAcceptedAt: acceptedAt,
        habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
        habeasDataAcceptedAt: acceptedAt,
        acceptedAt,
        ipAddress: legal.requestMeta.ipAddress,
        userAgent: legal.requestMeta.userAgent,
        locale: legal.locale || GUEST_LEGAL_LOCALE_DEFAULT,
        evidenceJson: {
          guestCount: guests.length,
          lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
          lodgingContractText: GUEST_LODGING_CONTRACT_SUMMARY_ES,
          habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
          habeasDataText: GUEST_HABEAS_DATA_SUMMARY_ES,
          acceptedAtUtc: acceptedAt.toISOString(),
        },
      },
      update: {
        acceptedByGuestId: owner.id,
        titularFullName: owner.fullName,
        titularDocumentType: owner.documentType,
        titularDocumentNumber: owner.documentNumber,
        lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
        lodgingContractAcceptedAt: acceptedAt,
        habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
        habeasDataAcceptedAt: acceptedAt,
        acceptedAt,
        ipAddress: legal.requestMeta.ipAddress,
        userAgent: legal.requestMeta.userAgent,
        locale: legal.locale || GUEST_LEGAL_LOCALE_DEFAULT,
        evidenceJson: {
          guestCount: guests.length,
          lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
          lodgingContractText: GUEST_LODGING_CONTRACT_SUMMARY_ES,
          habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
          habeasDataText: GUEST_HABEAS_DATA_SUMMARY_ES,
          acceptedAtUtc: acceptedAt.toISOString(),
        },
      },
    });
  });

  if (reservationMeta.property) {
    const { scheduleGuestRegistrationCompletionComms } = await import(
      "@/services/guests/guest-registration-completion-comms.service"
    );
    scheduleGuestRegistrationCompletionComms(reservationId);
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

  await reconcileReservationOccupancyIfSafe(registration.reservationId);

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      platform: true,
      guestName: true,
      reservationCode: true,
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
      guestName: true,
      reservationCode: true,
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

  await reconcileReservationOccupancyIfSafe(reservation.id);

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

  const guestData = buildCanonicalGuestWriteData(parsed);

  await db.$transaction(async (tx) => {
    await tx.reservationGuest.create({
      data: {
        reservationId: reservation.id,
        isPrimary: isOwner,
        isReservationOwner: isOwner,
        status: ReservationGuestStatus.REGISTERED,
        ...guestData,
      },
    });

    if (isOwner) {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          guestName: guestData.fullName,
          guestFirstName: guestData.firstName,
          guestLastName: guestData.lastName,
          guestEmail: guestData.email,
          guestPhone: guestData.phone,
          guestCountry: guestData.nationality,
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
  requestMeta: GuestRegistrationRequestMeta = {
    ipAddress: null,
    userAgent: null,
  },
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

  await reconcileReservationOccupancyIfSafe(registration.reservationId);

  const reservationForCapacity = await db.reservation.findUnique({
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
  if (!reservationForCapacity) {
    throw new GuestRegistrationError("Reserva no encontrada");
  }

  const maxCapacity = await resolveGuestRegistrationMaxCapacity(
    {
      id: reservationForCapacity.id,
      platform: reservationForCapacity.platform,
      adults: reservationForCapacity.adults,
      children: reservationForCapacity.children,
      infants: reservationForCapacity.infants,
      propertyMaxGuests: reservationForCapacity.property.maxGuests,
      guestRegistrationCompletedAt:
        reservationForCapacity.guestRegistrationCompletedAt,
    },
    registeredCount,
  );

  if (registeredCount !== maxCapacity) {
    throw new GuestRegistrationError(
      `Registro incompleto: debes registrar a los ${maxCapacity} huéspedes de la reserva (${registeredCount}/${maxCapacity}).`,
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

  await finalizeGuestRegistration(registration.id, registration.reservationId, {
    locale: parsed.locale ?? GUEST_LEGAL_LOCALE_DEFAULT,
    requestMeta,
  });

  const reservation = await db.reservation.findUnique({
    where: { id: registration.reservationId },
    select: {
      id: true,
      platform: true,
      guestName: true,
      reservationCode: true,
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
  requestMeta: GuestRegistrationRequestMeta = {
    ipAddress: null,
    userAgent: null,
  },
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
      propertyId: true,
      property: {
        select: { maxGuests: true, organizationId: true, ownerId: true },
      },
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
  if (parsed.guests.length !== maxCapacity) {
    throw new GuestRegistrationError(
      `Registro incompleto: debes registrar a los ${maxCapacity} huéspedes de la reserva (${parsed.guests.length}/${maxCapacity}).`,
    );
  }

  const primaryData = buildCanonicalGuestWriteData(parsed.guests[0]!);
  const acceptedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.reservationGuest.deleteMany({
      where: { reservationId: reservation.id },
    });

    await tx.reservationGuest.createMany({
      data: parsed.guests.map((guest, index) => {
        const data = buildCanonicalGuestWriteData(guest);
        return {
          reservationId: reservation.id,
          isPrimary: index === 0,
          isReservationOwner: index === 0,
          status: ReservationGuestStatus.REGISTERED,
          ...data,
        };
      }),
    });

    const owner = await tx.reservationGuest.findFirst({
      where: { reservationId: reservation.id, isReservationOwner: true },
      select: {
        id: true,
        fullName: true,
        documentType: true,
        documentNumber: true,
      },
    });

    if (!owner) {
      throw new GuestRegistrationError("No se pudo registrar el titular");
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        guestName: primaryData.fullName,
        guestFirstName: primaryData.firstName,
        guestLastName: primaryData.lastName,
        guestEmail: primaryData.email,
        guestPhone: primaryData.phone,
        guestCountry: primaryData.nationality,
        guestRegistrationCompletedAt: acceptedAt,
      },
    });

    await tx.guestRegistrationToken.update({
      where: { id: registration.id },
      data: {
        status: GuestRegistrationStatus.COMPLETED,
        usedAt: acceptedAt,
        attempts: { increment: 1 },
      },
    });

    await tx.guestRegistrationLegalAcceptance.upsert({
      where: { reservationId: reservation.id },
      create: {
        reservationId: reservation.id,
        organizationId: reservation.property.organizationId,
        propertyId: reservation.propertyId,
        acceptedByGuestId: owner.id,
        titularFullName: owner.fullName,
        titularDocumentType: owner.documentType,
        titularDocumentNumber: owner.documentNumber,
        lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
        lodgingContractAcceptedAt: acceptedAt,
        habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
        habeasDataAcceptedAt: acceptedAt,
        acceptedAt,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        locale: parsed.locale ?? GUEST_LEGAL_LOCALE_DEFAULT,
        evidenceJson: {
          guestCount: parsed.guests.length,
          lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
          lodgingContractText: GUEST_LODGING_CONTRACT_SUMMARY_ES,
          habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
          habeasDataText: GUEST_HABEAS_DATA_SUMMARY_ES,
          acceptedAtUtc: acceptedAt.toISOString(),
          path: "legacy_bulk_submit",
        },
      },
      update: {
        acceptedByGuestId: owner.id,
        titularFullName: owner.fullName,
        titularDocumentType: owner.documentType,
        titularDocumentNumber: owner.documentNumber,
        lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
        lodgingContractAcceptedAt: acceptedAt,
        habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
        habeasDataAcceptedAt: acceptedAt,
        acceptedAt,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
        locale: parsed.locale ?? GUEST_LEGAL_LOCALE_DEFAULT,
        evidenceJson: {
          guestCount: parsed.guests.length,
          lodgingContractVersion: GUEST_LODGING_CONTRACT_VERSION,
          lodgingContractText: GUEST_LODGING_CONTRACT_SUMMARY_ES,
          habeasDataPolicyVersion: GUEST_HABEAS_DATA_POLICY_VERSION,
          habeasDataText: GUEST_HABEAS_DATA_SUMMARY_ES,
          acceptedAtUtc: acceptedAt.toISOString(),
          path: "legacy_bulk_submit",
        },
      },
    });
  });

  if (reservation.property) {
    const { scheduleGuestRegistrationCompletionComms } = await import(
      "@/services/guests/guest-registration-completion-comms.service"
    );
    scheduleGuestRegistrationCompletionComms(reservation.id);
  }
}
