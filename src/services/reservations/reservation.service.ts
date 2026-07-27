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
import { getReservationActivityUnreadMap } from "@/services/reservation-activity/reservation-activity-unread.service";
import {
  assertPropertyInScope,
  assertReservationInScope,
} from "@/lib/platform/tenant-access";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  mergeReservationScope,
  type TenantDataScope,
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
import { purgeGhostReservationsThrottled } from "@/services/reservations/ghost-reservation.service";
import {
  assertReservationDateMutationAllowed,
  canUseHistoricalReservationOverride,
  isHistoricalOrClosedReservation,
} from "@/lib/reservations/reservation-mutation-policy";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { activateReservationPaymentHold } from "@/services/reservations/reservation-hold.service";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import { formatPropertyAddressForMessage } from "@/lib/property-display";
import {
  isOtaImportedReservation,
  OTA_RESERVATION_DELETE_MESSAGE,
} from "@/lib/reservations/reservation-ota";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";
import { buildGuestRegistrationAdminNotificationStatus } from "@/services/guests/guest-registration-admin-notification.service";

function computeGuestRegistrationProgress(input: {
  guests?: ReservationDetailItem["guests"];
  platform: ReservationInboxItem["platform"];
  adults: number;
  children: number;
  infants: number;
  propertyMaxGuests?: number;
  guestRegistrationCompletedAt?: Date | null;
}) {
  const registered =
    input.guests?.filter(
      (guest) => guest.status !== ReservationGuestStatus.PENDING_REGISTRATION,
    ).length ?? 0;
  const capacity = getGuestRegistrationMaxCapacity({
    platform: input.platform,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    propertyMaxGuests: input.propertyMaxGuests,
    guestRegistrationCompletedAt: input.guestRegistrationCompletedAt,
    registeredCount: registered > 0 ? registered : undefined,
  });
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
  reservationCode?: string | null;
  icalUid?: string | null;
  updatedAt?: Date;
  holdExpiresAt?: Date | null;
  totalAmount: { toString(): string };
  currency: string;
  internalNotes: string | null;
  guestRegistrationToken?: string | null;
  guestRegistrationCompletedAt?: Date | null;
  guestRegistrationAdminNotifiedAt?: Date | null;
  guestRegistrationAdminNotificationError?: string | null;
  guestRegistrationAdminNotificationLog?: unknown;
  property: ReservationInboxItem["property"] & {
    notificationEmails?: unknown;
    operationalContacts?: unknown;
    guestRegistrationContactKey?: string | null;
  };
  guests?: ReservationDetailItem["guests"];
  guestRegistration?: ReservationInboxItem["guestRegistration"];
  guestRegistrationProgress?: ReservationInboxItem["guestRegistrationProgress"];
  accessCode?: ReservationDetailItem["accessCode"];
  airbnbEnrichmentGuestName?: string | null;
  activityUnreadCount?: number;
  activityUnreadHint?: string | null;

};

function toInboxItem(r: ReservationRow): ReservationInboxItem {
  const ownerGuest =
    r.guests?.find((guest) => guest.isReservationOwner) ??
    r.guests?.find((guest) => guest.isPrimary);
  const visibleGuestName = resolveReservationDisplayGuestName({
    platform: r.platform,
    airbnbEnrichmentGuestName: r.airbnbEnrichmentGuestName,
    guestName: r.guestName,
    primaryGuestName: ownerGuest?.fullName,
    guestRegistrationCompletedAt: r.guestRegistrationCompletedAt,
  });
  const progress = computeGuestRegistrationProgress({
    guests: r.guests,
    platform: r.platform,
    adults: r.adults,
    children: r.children,
    infants: r.infants,
    propertyMaxGuests: r.property.maxGuests,
    guestRegistrationCompletedAt: r.guestRegistrationCompletedAt,
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
    reservationCode: r.reservationCode ?? null,
    icalUid: r.icalUid ?? null,
    updatedAt: r.updatedAt?.toISOString(),
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
    guestRegistrationAdminNotification:
      r.guestRegistrationCompletedAt &&
      "guestRegistrationAdminNotifiedAt" in r
        ? (() => {
            try {
              return buildGuestRegistrationAdminNotificationStatus({
                guestRegistrationCompletedAt: r.guestRegistrationCompletedAt,
                guestRegistrationAdminNotifiedAt:
                  r.guestRegistrationAdminNotifiedAt ?? null,
                guestRegistrationAdminNotificationError:
                  r.guestRegistrationAdminNotificationError ?? null,
                guestRegistrationAdminNotificationLog:
                  r.guestRegistrationAdminNotificationLog ?? [],
                notificationEmails: r.property.notificationEmails ?? [],
                operationalContacts: r.property.operationalContacts ?? [],
                guestRegistrationContactKey:
                  r.property.guestRegistrationContactKey ?? null,
              });
            } catch (error) {
              console.warn(
                "[toInboxItem] admin notification status skipped:",
                error,
              );
              return null;
            }
          })()
        : null,
    guestRegistration: r.guestRegistration ?? null,
    guestRegistrationProgress: progress,
    accessCode: r.accessCode ?? null,
    property: {
      id: r.property.id,
      name: r.property.name,
      unitNumber: r.property.unitNumber ?? null,
      address: formatPropertyAddressForMessage({
        address: r.property.address,
        neighborhood: r.property.neighborhood ?? null,
      }),
      neighborhood: r.property.neighborhood ?? null,
      city: r.property.city,
      maxGuests: r.property.maxGuests,
      coverImageUrl:
        "coverImageUrl" in r.property ? r.property.coverImageUrl ?? null : null,
      propertyType:
        "propertyType" in r.property ? r.property.propertyType : undefined,
      checkInTime:
        "checkInTime" in r.property ? r.property.checkInTime : undefined,
      checkOutTime:
        "checkOutTime" in r.property ? r.property.checkOutTime : undefined,
      accessCode:
        "accessCode" in r.property ? r.property.accessCode : undefined,
      accessInstructions:
        "accessInstructions" in r.property
          ? r.property.accessInstructions
          : undefined,
      houseRules:
        "houseRules" in r.property ? r.property.houseRules : undefined,
      wifiName:
        "wifiName" in r.property ? r.property.wifiName : undefined,
      wifiPassword:
        "wifiPassword" in r.property ? r.property.wifiPassword : undefined,
      receptionWhatsapp:
        "receptionWhatsapp" in r.property ? r.property.receptionWhatsapp : undefined,
    },
    activityUnreadCount: r.activityUnreadCount ?? 0,
    activityUnreadHint: r.activityUnreadHint ?? null,
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

export type ReservationSearchHit = {
  id: string;
  guestName: string;
  reservationCode: string | null;
  checkIn: string;
  checkOut: string;
  propertyName: string;
  propertyUnitNumber: string | null;
};

const CALENDAR_SEARCH_LIMIT = 20;

/** Búsqueda ligera org-scoped para el calendario (huésped / código / id). */
export async function searchReservationsForCalendar(
  query: string,
  limit = CALENDAR_SEARCH_LIMIT,
): Promise<ReservationSearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const scope = await requireTenantDataScope();
  const take = Math.min(Math.max(limit, 1), 50);
  const rows = await db.reservation.findMany({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, {
        OR: [
          { guestName: { contains: q, mode: "insensitive" } },
          { guestFirstName: { contains: q, mode: "insensitive" } },
          { guestLastName: { contains: q, mode: "insensitive" } },
          { reservationCode: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      }),
    ),
    take,
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
        },
      },
    },
    orderBy: [{ checkIn: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    guestName: row.guestName,
    reservationCode: row.reservationCode,
    checkIn: prismaDateToKey(row.checkIn),
    checkOut: prismaDateToKey(row.checkOut),
    propertyName: row.property.name,
    propertyUnitNumber: row.property.unitNumber ?? null,
  }));
}

export async function listReservationsForInbox(): Promise<ReservationInboxItem[]> {
  const scope = await requireTenantDataScope();
  await purgeGhostReservationsThrottled(scope);
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
      reservationCode: true,
      icalUid: true,
      updatedAt: true,
      paymentStatus: true,
      holdExpiresAt: true,
      totalAmount: true,
      currency: true,
      internalNotes: true,
      guestRegistrationToken: true,
      guestRegistrationCompletedAt: true,
      property: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const ids = rows.map((row) => row.id);
  const [guestsByReservation, registrationsByReservation, airbnbGuestByReservation, activityUnreadMap] =
    await Promise.all([
    getGuestsByReservationIds(ids),
    getRegistrationsByReservationIds(ids),
    getAirbnbEnrichedGuestNameByReservationIds(ids),
    getReservationActivityUnreadMap(scope, ids),
  ]);

  return rows.map((row) => {
    const unread = activityUnreadMap.get(row.id);
    return toInboxItem({
      ...row,
      property: {
        ...row.property,
        neighborhood: row.property.neighborhood,
      },
      guests: guestsByReservation.get(row.id) ?? [],
      guestRegistration: registrationsByReservation.get(row.id) ?? null,
      airbnbEnrichmentGuestName: airbnbGuestByReservation.get(row.id) ?? null,
      activityUnreadCount: unread?.unreadCount ?? 0,
      activityUnreadHint: unread?.hint ?? null,
    });
  });
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
export async function getReservationMutationContext(id: string) {
  const scope = await requireTenantDataScope();
  const row = await db.reservation.findFirst({
    where: mergeReservationScope(scope, { id }),
    select: {
      id: true,
      platform: true,
      checkIn: true,
      checkOut: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    platform: row.platform,
    checkIn: prismaDateToKey(row.checkIn),
    checkOut: prismaDateToKey(row.checkOut),
  };
}

/** Detalle completo para panel/drawer (respeta filtros de visibilidad del calendario). */
export async function getReservationForInbox(
  id: string,
  scopeOverride?: TenantDataScope,
): Promise<ReservationDetailItem | null> {
  const scope = scopeOverride ?? (await requireTenantDataScope());
  let row = await db.reservation.findFirst({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, { id }),
    ),
    include: {
      property: true,
    },
  });

  // Calendar already showed this bar — if the orphan filter races with iCal
  // disconnect, still open detail within tenant scope (SSOT: don't 404 the click).
  if (!row) {
    row = await db.reservation.findFirst({
      where: mergeReservationScope(scope, { id }),
      include: { property: true },
    });
  }
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

  const emptyGuests = new Map<string, ReservationDetailItem["guests"]>();
  const emptyAirbnbNames = new Map<string, string>();
  const emptyActivity = new Map<
    string,
    { unreadCount: number; hint: string | null }
  >();

  const [
    guestsByReservation,
    registration,
    accessCredential,
    airbnbGuestByReservation,
    activityUnreadMap,
  ] = await Promise.all([
    getGuestsByReservationIds([row.id]).catch((error) => {
      console.warn("[getReservationForInbox] guests skipped:", error);
      return emptyGuests;
    }),
    getActiveGuestRegistrationForReservation(row.id).catch((error) => {
      console.warn("[getReservationForInbox] registration skipped:", error);
      return null;
    }),
    db.accessCredential
      .findFirst({
        where: {
          reservationId: row.id,
          ttlockCodeId: { not: null },
          status: {
            in: ["GENERATED", "SENT", "ACTIVE"],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          codeEncrypted: true,
          ttlockCodeId: true,
          validFrom: true,
          validTo: true,
        },
      })
      .catch((error) => {
        console.warn("[getReservationForInbox] access skipped:", error);
        return null;
      }),
    getAirbnbEnrichedGuestNameByReservationIds([row.id]).catch((error) => {
      console.warn("[getReservationForInbox] airbnb name skipped:", error);
      return emptyAirbnbNames;
    }),
    getReservationActivityUnreadMap(scope, [row.id]).catch((error) => {
      console.warn("[getReservationForInbox] activity skipped:", error);
      return emptyActivity;
    }),
  ]);

  let accessCode: ReservationDetailItem["accessCode"] = null;
  try {
    accessCode = accessCredential
      ? {
          status: accessCredential.status,
          code: formatAccessCode(
            decryptTTLockSecret(accessCredential.codeEncrypted),
          ),
          isActive: ["GENERATED", "SENT", "ACTIVE"].includes(
            accessCredential.status,
          ),
          validFrom: accessCredential.validFrom?.toISOString() ?? null,
          validTo: accessCredential.validTo?.toISOString() ?? null,
        }
      : null;
  } catch (error) {
    console.warn("[getReservationForInbox] access code skipped:", error);
  }

  const unread = activityUnreadMap.get(row.id);

  try {
    return toDetailItem(
      {
        ...row,
        property: {
          ...row.property,
          neighborhood: row.property.neighborhood,
        },
        guests: guestsByReservation.get(row.id) ?? [],
        guestRegistration: registration,
        accessCode,
        airbnbEnrichmentGuestName: airbnbGuestByReservation.get(row.id) ?? null,
        activityUnreadCount: unread?.unreadCount ?? 0,
        activityUnreadHint: unread?.hint ?? null,
      },
      relatedBlocks,
    );
  } catch (error) {
    console.error("[getReservationForInbox] toDetailItem failed:", id, error);
    throw error;
  }
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
  const status = deriveReservationStatusFromDates(checkIn, checkOut, {
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
  });

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

  // Bienvenida Direct: al confirmar, con correo válido — antes del hold de pago.
  // Si totalAmount > 0 el hold se activa después; post-hold reintenta de forma idempotente.
  if (
    created.platform === BookingPlatform.DIRECT &&
    isGuestRegistrationEligiblePlatform(created.platform) &&
    isGuestRegistrationEligibleStatus(created.status)
  ) {
    await ensureGuestRegistrationForReservation(created.id);
    if (created.guestEmail?.trim()) {
      await sendGuestRegistrationEmailForReservation(created.id, {
        triggeredBy: "auto",
      }).catch((err) => {
        console.warn("[guest-registration-email] No enviado", created.id, err);
      });
    }
  }

  const requiresPaymentHold = data.totalAmount > 0;
  if (requiresPaymentHold) {
    await activateReservationPaymentHold({
      reservationId: created.id,
      createdById: tenantCtx.userId,
      totalAmount: data.totalAmount,
    });
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

export class OtaReservationDeleteError extends Error {
  constructor(message = OTA_RESERVATION_DELETE_MESSAGE) {
    super(message);
    this.name = "OtaReservationDeleteError";
  }
}

export async function deleteReservation(id: string) {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, id);
  const existing = await db.reservation.findUnique({
    where: { id },
    select: { platform: true, icalUid: true, propertyId: true },
  });
  if (!existing) {
    throw new Error("Reserva no encontrada");
  }
  if (isOtaImportedReservation(existing)) {
    throw new OtaReservationDeleteError();
  }
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
