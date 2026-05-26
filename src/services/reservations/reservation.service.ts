import type { ReservationWizardValues } from "@/features/reservations/schemas/reservation.schema";
import type { ReservationEditValues } from "@/features/reservations/schemas/reservation.schema";
import type {
  ReservationDetailItem,
  ReservationInboxItem,
  ReservationRelatedBlock,
} from "@/features/reservations/types/reservation.types";
import { GuestRegistrationStatus, PropertyStatus, ReservationGuestStatus, ReservationStatus, BookingPlatform } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  assertPropertyInScope,
  assertReservationInScope,
} from "@/lib/platform/tenant-access";
import {
  mergeReservationScope,
} from "@/lib/platform/tenant-data-scope";
import { touchPropertyIcalExport } from "@/services/airbnb/airbnb-export-push.service";
import { emitBookingCancelled, emitBookingConfirmed } from "@/modules/integrations/ttlock/ttlock.events";
import {
  buildGuestRegistrationUrl,
  ensureGuestRegistrationForReservation,
  getActiveGuestRegistrationForReservation,
  isGuestRegistrationEligiblePlatform,
  isGuestRegistrationEligibleStatus,
} from "@/services/guests/guest-registration.service";
import { sendGuestRegistrationEmailForReservation } from "@/services/guests/guest-registration-email.service";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import { formatAccessCode } from "@/lib/access-code";
import { assertNoReservationOverlap } from "@/services/reservations/reservation-conflicts";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";
import { purgeGhostReservations } from "@/services/reservations/ghost-reservation.service";
import {
  assertReservationDateMutationAllowed,
  canUseHistoricalReservationOverride,
  isHistoricalOrClosedReservation,
} from "@/lib/reservations/reservation-mutation-policy";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { activateReservationPaymentHold } from "@/services/reservations/reservation-hold.service";

function computeGuestRegistrationProgress(input: {
  guests?: ReservationDetailItem["guests"];
  propertyMaxGuests?: number;
}) {
  const capacity = Math.max(1, input.propertyMaxGuests ?? 1);
  const registered =
    input.guests?.filter(
      (guest) => guest.status !== ReservationGuestStatus.PENDING_REGISTRATION,
    ).length ?? 0;
  return { registered, capacity };
}

function buildGuestName(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(" ");
}

type ReservationRow = {
  id: string;
  guestName: string;
  guestFirstName: string;
  guestLastName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCountry: string | null;
  guestLanguage: string | null;
  adults: number;
  children: number;
  infants: number;
  checkIn: Date;
  checkOut: Date;
  createdAt?: Date;
  platform: ReservationInboxItem["platform"];
  status: ReservationInboxItem["status"];
  paymentStatus?: ReservationInboxItem["paymentStatus"];
  holdExpiresAt?: Date | null;
  totalAmount: { toString(): string };
  currency: string;
  internalNotes: string | null;
  guestRegistrationToken?: string | null;
  guestRegistrationCompletedAt?: Date | null;
  property: ReservationInboxItem["property"];
  guests?: ReservationDetailItem["guests"];
  guestRegistration?: ReservationInboxItem["guestRegistration"];
  guestRegistrationProgress?: ReservationInboxItem["guestRegistrationProgress"];
  accessCode?: ReservationDetailItem["accessCode"];
};

function toInboxItem(r: ReservationRow): ReservationInboxItem {
  const ownerGuest =
    r.guests?.find((guest) => guest.isReservationOwner) ??
    r.guests?.find((guest) => guest.isPrimary);
  const visibleGuestName =
    ownerGuest?.fullName.trim() || r.guestName.trim() || "Registro pendiente";
  const progress = computeGuestRegistrationProgress({
    guests: r.guests,
    propertyMaxGuests: r.property.maxGuests,
  });

  return {
    id: r.id,
    guestName: visibleGuestName,
    guestFirstName: r.guestFirstName,
    guestLastName: r.guestLastName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    guestCountry: r.guestCountry,
    guestLanguage: r.guestLanguage,
    adults: r.adults,
    children: r.children,
    infants: r.infants,
    checkIn: prismaDateToKey(r.checkIn),
    checkOut: prismaDateToKey(r.checkOut),
    createdAt: r.createdAt?.toISOString(),
    platform: r.platform,
    status: r.status,
    paymentStatus: r.paymentStatus,
    holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null,
    totalAmount: r.totalAmount.toString(),
    currency: r.currency,
    internalNotes: r.internalNotes,
    guestRegistrationUrl:
      r.guestRegistration?.url ??
      (r.guestRegistrationToken
        ? buildGuestRegistrationUrl(r.guestRegistrationToken)
        : null),
    guestRegistrationCompletedAt:
      r.guestRegistration?.usedAt ??
      r.guestRegistrationCompletedAt?.toISOString() ??
      null,
    guestRegistration: r.guestRegistration ?? null,
    guestRegistrationProgress: progress,
    property: {
      id: r.property.id,
      name: r.property.name,
      unitNumber: r.property.unitNumber ?? null,
      address: r.property.address,
      city: r.property.city,
      maxGuests: r.property.maxGuests,
      propertyType:
        "propertyType" in r.property ? r.property.propertyType : undefined,
      checkInTime:
        "checkInTime" in r.property ? r.property.checkInTime : undefined,
      checkOutTime:
        "checkOutTime" in r.property ? r.property.checkOutTime : undefined,
    },
  };
}

async function getGuestsByReservationIds(reservationIds: string[]) {
  if (reservationIds.length === 0) return new Map();

  const guests = await db.reservationGuest.findMany({
    where: { reservationId: { in: reservationIds } },
    orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
  });

  const byReservation = new Map<string, ReservationDetailItem["guests"]>();
  for (const guest of guests) {
    const list = byReservation.get(guest.reservationId) ?? [];
    list.push({
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
    });
    byReservation.set(guest.reservationId, list);
  }
  return byReservation;
}

async function getRegistrationsByReservationIds(reservationIds: string[]) {
  if (reservationIds.length === 0) return new Map<string, ReservationInboxItem["guestRegistration"]>();

  const tokens = await db.guestRegistrationToken.findMany({
    where: {
      reservationId: { in: reservationIds },
      status: {
        in: [GuestRegistrationStatus.ACTIVE, GuestRegistrationStatus.COMPLETED],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const byReservation = new Map<string, ReservationInboxItem["guestRegistration"]>();
  for (const token of tokens) {
    if (byReservation.has(token.reservationId)) continue;
    byReservation.set(token.reservationId, {
      token: token.token,
      status: token.status,
      url: buildGuestRegistrationUrl(token.token),
      createdAt: token.createdAt.toISOString(),
      expiresAt: token.expiresAt?.toISOString() ?? null,
      usedAt: token.usedAt?.toISOString() ?? null,
    });
  }
  return byReservation;
}

const INBOX_RESERVATION_LIMIT = 1000;

export async function listReservationsForInbox(): Promise<ReservationInboxItem[]> {
  const scope = await requireTenantDataScope();
  await purgeGhostReservations(scope);
  const rows = await db.reservation.findMany({
    where: withVisibleReservationsFilter(mergeReservationScope(scope, {})),
    take: INBOX_RESERVATION_LIMIT,
    select: {
      id: true,
      guestName: true,
      guestFirstName: true,
      guestLastName: true,
      guestEmail: true,
      guestPhone: true,
      guestCountry: true,
      guestLanguage: true,
      adults: true,
      children: true,
      infants: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
      platform: true,
      status: true,
      paymentStatus: true,
      holdExpiresAt: true,
      totalAmount: true,
      currency: true,
      internalNotes: true,
      guestRegistrationToken: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: { id: true, name: true, unitNumber: true, address: true, city: true, maxGuests: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const ids = rows.map((row) => row.id);
  const [guestsByReservation, registrationsByReservation] = await Promise.all([
    getGuestsByReservationIds(ids),
    getRegistrationsByReservationIds(ids),
  ]);

  return rows.map((row) =>
    toInboxItem({
      ...row,
      guests: guestsByReservation.get(row.id) ?? [],
      guestRegistration: registrationsByReservation.get(row.id) ?? null,
    }),
  );
}

/** @deprecated Usar listReservationsForInbox */
export async function listReservations() {
  return db.reservation.findMany({
    include: { property: { select: { name: true } } },
    orderBy: { checkIn: "desc" },
  });
}

export async function getReservationById(id: string) {
  return db.reservation.findUnique({
    where: { id },
    include: { property: true },
  });
}

type ReservationDetailRow = ReservationRow & {
  createdAt: Date;
  icalUid: string | null;
};

function toDetailItem(
  row: ReservationDetailRow,
  relatedBlocks: ReservationRelatedBlock[],
): ReservationDetailItem {
  return {
    ...toInboxItem(row),
    createdAt: row.createdAt.toISOString(),
    icalUid: row.icalUid,
    guests: row.guests ?? [],
    relatedBlocks,
    accessCode: row.accessCode ?? null,
  };
}

/** Detalle completo para panel/drawer (respeta filtros de visibilidad del calendario). */
export async function getReservationForInbox(
  id: string,
): Promise<ReservationDetailItem | null> {
  const scope = await requireTenantDataScope();
  const row = await db.reservation.findFirst({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, { id }),
    ),
    include: {
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          address: true,
          city: true,
          maxGuests: true,
          propertyType: true,
          checkInTime: true,
          checkOutTime: true,
        },
      },
    },
  });
  if (!row) return null;

  const blockRows = await db.reservation.findMany({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, {
        propertyId: row.propertyId,
        id: { not: row.id },
        status: ReservationStatus.BLOCKED,
        checkIn: { lt: row.checkOut },
        checkOut: { gt: row.checkIn },
      }),
    ),
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
    },
    orderBy: { checkIn: "asc" },
  });

  const relatedBlocks: ReservationRelatedBlock[] = blockRows.map((b) => ({
    id: b.id,
    guestName: b.guestName,
    checkIn: prismaDateToKey(b.checkIn),
    checkOut: prismaDateToKey(b.checkOut),
  }));

  const [guestsByReservation, registration, accessCredential] = await Promise.all([
    getGuestsByReservationIds([row.id]),
    getActiveGuestRegistrationForReservation(row.id),
    db.accessCredential.findFirst({
      where: { reservationId: row.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, codeEncrypted: true },
    }),
  ]);

  const accessCode = accessCredential
    ? {
        status: accessCredential.status,
        code: formatAccessCode(decryptTTLockSecret(accessCredential.codeEncrypted)),
        isActive: ["GENERATED", "SENT", "ACTIVE"].includes(
          accessCredential.status,
        ),
      }
    : null;

  return toDetailItem(
    {
      ...row,
      guests: guestsByReservation.get(row.id) ?? [],
      guestRegistration: registration,
      accessCode,
    },
    relatedBlocks,
  );
}

export async function createReservation(data: ReservationWizardValues) {
  const [scope, tenantCtx] = await Promise.all([
    requireTenantDataScope(),
    requireTenantContext(),
  ]);
  const allowHistoricalOverride = canUseHistoricalReservationOverride(tenantCtx);

  assertReservationDateMutationAllowed({
    operation: "create",
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    allowHistoricalOverride,
  });

  if (allowHistoricalOverride && data.checkIn < prismaDateToKey(new Date())) {
    await writePlatformAuditLog({
      platformUserId: tenantCtx.userId,
      ownerEmail: tenantCtx.email,
      action: "reservation_create_historical_override",
      targetTenantId: scope.organizationId,
      metadata: {
        propertyId: data.propertyId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
      },
    });
  }

  await assertPropertyInScope(scope, data.propertyId);

  const property = await db.property.findFirst({
    where: {
      id: data.propertyId,
      status: PropertyStatus.ACTIVE,
      ...scope.organizationId
        ? { organizationId: scope.organizationId }
        : { ownerId: scope.userId },
    },
  });
  if (!property) throw new Error("Propiedad no encontrada");

  if (data.platform !== BookingPlatform.DIRECT) {
    throw new Error(
      "Solo se permiten reservas directas. Las reservas de Airbnb se importan desde el calendario sincronizado.",
    );
  }

  const guestTotal = data.adults + data.children + data.infants;
  if (guestTotal > property.maxGuests) {
    throw new Error(
      `Máximo ${property.maxGuests} huésped${property.maxGuests === 1 ? "" : "es"} (capacidad de la propiedad)`,
    );
  }

  const checkIn = dateKeyToPrismaDate(data.checkIn);
  const checkOut = dateKeyToPrismaDate(data.checkOut);
  await assertNoReservationOverlap(data.propertyId, checkIn, checkOut);

  const guestName = buildGuestName(data.guestFirstName, data.guestLastName);
  const status = deriveReservationStatusFromDates(checkIn, checkOut);

  const created = await db.reservation.create({
    data: {
      propertyId: data.propertyId,
      guestName,
      guestFirstName: data.guestFirstName.trim(),
      guestLastName: data.guestLastName?.trim() || null,
      guestEmail: data.guestEmail?.trim() || null,
      guestPhone: data.guestPhone?.trim() || null,
      guestCountry: data.guestCountry?.trim() || null,
      guestLanguage: data.guestLanguage?.trim() || null,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      checkIn,
      checkOut,
      platform: BookingPlatform.DIRECT,
      status,
      paymentStatus:
        data.totalAmount > 0 ? "PENDING" : "PAID",
      totalAmount: data.totalAmount,
      internalNotes: data.internalNotes?.trim() || null,
    },
    include: {
      property: {
        select: { id: true, name: true, unitNumber: true, address: true, city: true, ownerId: true },
      },
    },
  });

  await touchPropertyIcalExport(data.propertyId);

  await emitBookingConfirmed({
    reservationId: created.id,
    propertyId: created.propertyId,
    ownerId: created.property.ownerId,
  });

  const requiresPaymentHold = data.totalAmount > 0;

  if (requiresPaymentHold) {
    await activateReservationPaymentHold({
      reservationId: created.id,
      createdById: tenantCtx.userId,
      totalAmount: data.totalAmount,
    });
  } else if (
    isGuestRegistrationEligiblePlatform(created.platform) &&
    isGuestRegistrationEligibleStatus(created.status)
  ) {
    await ensureGuestRegistrationForReservation(created.id);
    if (created.guestEmail?.trim()) {
      await sendGuestRegistrationEmailForReservation(created.id).catch((err) => {
        console.warn("[guest-registration-email] No enviado", created.id, err);
      });
    }
  }

  return created;
}

export async function updateReservation(
  id: string,
  data: ReservationEditValues,
) {
  const [scope, tenantCtx] = await Promise.all([
    requireTenantDataScope(),
    requireTenantContext(),
  ]);
  await assertReservationInScope(scope, id);
  const existing = await db.reservation.findFirst({
    where: { id },
    select: { checkIn: true, checkOut: true, status: true, propertyId: true },
  });
  if (!existing) throw new Error("Reserva no encontrada");

  const allowHistoricalOverride = canUseHistoricalReservationOverride(tenantCtx);
  const existingCheckIn = prismaDateToKey(existing.checkIn);
  const existingCheckOut = prismaDateToKey(existing.checkOut);

  assertReservationDateMutationAllowed({
    operation: "update",
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    existing: {
      checkIn: existingCheckIn,
      checkOut: existingCheckOut,
      status: existing.status,
    },
    allowHistoricalOverride,
  });

  if (
    allowHistoricalOverride &&
    (isHistoricalOrClosedReservation(existingCheckOut, existing.status) ||
      data.checkIn < prismaDateToKey(new Date()) ||
      data.checkOut < prismaDateToKey(new Date()))
  ) {
    await writePlatformAuditLog({
      platformUserId: tenantCtx.userId,
      ownerEmail: tenantCtx.email,
      action: "reservation_update_historical_override",
      targetTenantId: scope.organizationId,
      metadata: {
        reservationId: id,
        previous: {
          checkIn: existingCheckIn,
          checkOut: existingCheckOut,
          status: existing.status,
        },
        next: { checkIn: data.checkIn, checkOut: data.checkOut },
      },
    });
  }

  await assertPropertyInScope(scope, data.propertyId);

  const property = await db.property.findFirst({
    where: {
      id: data.propertyId,
      status: PropertyStatus.ACTIVE,
      ...scope.organizationId
        ? { organizationId: scope.organizationId }
        : { ownerId: scope.userId },
    },
    select: { id: true, maxGuests: true },
  });
  if (!property) throw new Error("Propiedad no encontrada");

  const guestTotal = data.adults + data.children + data.infants;
  if (guestTotal > property.maxGuests) {
    throw new Error(
      `Máximo ${property.maxGuests} huésped${property.maxGuests === 1 ? "" : "es"} (capacidad de la propiedad)`,
    );
  }

  const checkIn = dateKeyToPrismaDate(data.checkIn);
  const checkOut = dateKeyToPrismaDate(data.checkOut);
  await assertNoReservationOverlap(data.propertyId, checkIn, checkOut, id);

  const guestName = buildGuestName(data.guestFirstName, data.guestLastName);

  const updated = await db.reservation.update({
    where: { id },
    data: {
      propertyId: data.propertyId,
      guestName,
      guestFirstName: data.guestFirstName.trim(),
      guestLastName: data.guestLastName?.trim() || null,
      guestEmail: data.guestEmail?.trim() || null,
      guestPhone: data.guestPhone?.trim() || null,
      guestCountry: data.guestCountry?.trim() || null,
      guestLanguage: data.guestLanguage?.trim() || null,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      checkIn,
      checkOut,
      totalAmount: data.totalAmount,
      internalNotes: data.internalNotes?.trim() || null,
    },
    include: {
      property: {
        select: { id: true, name: true, unitNumber: true, address: true, city: true, maxGuests: true },
      },
    },
  });

  if (existing.propertyId !== data.propertyId) {
    await touchPropertyIcalExport(existing.propertyId);
  }
  await touchPropertyIcalExport(data.propertyId);

  return updated;
}

export async function deleteReservation(id: string) {
  const scope = await requireTenantDataScope();
  const existing = await assertReservationInScope(scope, id);
  const property = await db.property.findUnique({
    where: { id: existing.propertyId },
    select: { ownerId: true },
  });
  if (property) {
    await emitBookingCancelled({
      reservationId: id,
      propertyId: existing.propertyId,
      ownerId: property.ownerId,
    });
  }
  const deleted = await db.reservation.delete({ where: { id } });
  await touchPropertyIcalExport(existing.propertyId);
  return deleted;
}
