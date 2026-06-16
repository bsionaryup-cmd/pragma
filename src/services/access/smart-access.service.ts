import {
  AccessCredentialStatus,
  type PropertyType,
  ReservationStatus,
} from "@prisma/client";
import { formatAccessCode } from "@/lib/access-code";
import { resolvePropertyUnit } from "@/lib/property-display";
import {
  dateKeyToPrismaDate,
  prismaDateToKey,
  todayDateKeyInTimezone,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { getGuestRegistrationMaxCapacity } from "@/lib/guest-registration/guest-registration-capacity";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import {
  ensureTTLockIntegrationForScope,
  isTTLockIntegrationConnected,
} from "@/modules/integrations/ttlock/ttlock.persistence";

export type SmartAccessStage =
  | "awaiting_registration"
  | "awaiting_integration"
  | "awaiting_lock"
  | "pending_approval"
  | "ready_to_generate"
  | "generated"
  | "suspended"
  | "revoked"
  | "expired";

export type SmartAccessItem = {
  id: string;
  guestName: string;
  propertyName: string;
  propertyUnitNumber: string | null;
  propertyType: PropertyType;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  registrationComplete: boolean;
  registrationCompletedAt: string | null;
  registrationProgress?: string | null;
  stage: SmartAccessStage;
  stageLabel: string;
  credential: {
    id: string;
    status: AccessCredentialStatus;
    code: string | null;
    validFrom: string | null;
    validTo: string | null;
    ttlockCodeId: string | null;
  } | null;
  lockMapped: boolean;
  integrationConnected: boolean;
};

export type SmartAccessOverview = {
  items: SmartAccessItem[];
  metrics: {
    total: number;
    awaitingRegistration: number;
    readyForCode: number;
    codesActive: number;
    integrationConnected: boolean;
    locksMapped: number;
  };
};

const STAGE_LABELS: Record<SmartAccessStage, string> = {
  awaiting_registration: "Registro pendiente",
  awaiting_integration: "Conexión pendiente",
  awaiting_lock: "Sin cerradura vinculada",
  pending_approval: "Pendiente de aprobación",
  ready_to_generate: "Listo para generar código",
  generated: "Código generado",
  suspended: "Código suspendido",
  revoked: "Código revocado",
  expired: "Código expirado",
};

async function expireStaleAccessCredentials(scope: {
  organizationId: string | null;
  userId: string;
}) {
  const reservationScope = scope.organizationId
    ? { property: { organizationId: scope.organizationId } }
    : { property: { ownerId: scope.userId } };

  await db.accessCredential.updateMany({
    where: {
      status: {
        in: [
          AccessCredentialStatus.PENDING,
          AccessCredentialStatus.GENERATED,
          AccessCredentialStatus.ACTIVE,
          AccessCredentialStatus.SENT,
          AccessCredentialStatus.SUSPENDED,
        ],
      },
      validTo: { not: null, lt: new Date() },
      reservation: reservationScope,
    },
    data: { status: AccessCredentialStatus.EXPIRED },
  });
}

function resolveStage(input: {
  registrationComplete: boolean;
  integrationConnected: boolean;
  lockMapped: boolean;
  credentialStatus: AccessCredentialStatus | null;
}): SmartAccessStage {
  if (!input.registrationComplete) return "awaiting_registration";
  if (!input.integrationConnected) return "awaiting_integration";
  if (!input.lockMapped) return "awaiting_lock";

  switch (input.credentialStatus) {
    case AccessCredentialStatus.PENDING:
      return "pending_approval";
    case AccessCredentialStatus.GENERATED:
    case AccessCredentialStatus.SENT:
    case AccessCredentialStatus.ACTIVE:
      return "generated";
    case AccessCredentialStatus.SUSPENDED:
      return "suspended";
    case AccessCredentialStatus.REVOKED:
      return "revoked";
    case AccessCredentialStatus.EXPIRED:
      return "expired";
    default:
      return "ready_to_generate";
  }
}

export async function getSmartAccessOverview(): Promise<SmartAccessOverview> {
  const scope = await requireTenantDataScope();
  await expireStaleAccessCredentials(scope);
  const today = dateKeyToPrismaDate(todayDateKeyInTimezone());

  const integration = await ensureTTLockIntegrationForScope(scope);
  const integrationConnected = isTTLockIntegrationConnected(integration);

  const propertyScope = scope.organizationId
    ? { organizationId: scope.organizationId }
    : { ownerId: scope.userId };

  const reservations = await db.reservation.findMany({
    where: {
      property: propertyScope,
      status: {
        in: [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKED_IN,
          ReservationStatus.CHECKOUT_TODAY,
        ],
      },
      checkOut: { gte: today },
    },
    orderBy: { checkIn: "asc" },
    take: 80,
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      platform: true,
      guestName: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          maxGuests: true,
          propertyType: true,
          checkInTime: true,
          checkOutTime: true,
          propertyLock: { select: { id: true } },
        },
      },
      guests: {
        where: {
          status: {
            in: ["REGISTERED", "VERIFIED", "CHECKED_IN", "CHECKED_OUT"],
          },
        },
        orderBy: [{ isReservationOwner: "desc" }, { isPrimary: "desc" }],
        select: { id: true, fullName: true, isReservationOwner: true, isPrimary: true },
      },
      accessCredentials: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          codeEncrypted: true,
          validFrom: true,
          validTo: true,
          ttlockCodeId: true,
        },
      },
    },
  });

  const locksMapped = await db.propertyLock.count({
    where: {
      property: propertyScope,
    },
  });

  const sortedReservations = [...reservations].sort((a, b) =>
    a.checkIn.getTime() - b.checkIn.getTime(),
  );

  const airbnbGuestByReservation = await getAirbnbEnrichedGuestNameByReservationIds(
    sortedReservations.map((reservation) => reservation.id),
  );

  const items: SmartAccessItem[] = sortedReservations.map((reservation) => {
    const credentialRow = reservation.accessCredentials[0] ?? null;
    const lockMapped = Boolean(reservation.property.propertyLock);
    const registrationComplete = Boolean(reservation.guestRegistrationCompletedAt);
    const capacity = getGuestRegistrationMaxCapacity({
      platform: reservation.platform,
      adults: reservation.adults,
      children: reservation.children,
      infants: reservation.infants,
      propertyMaxGuests: reservation.property.maxGuests,
      guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
      registeredCount: reservation.guests.length > 0 ? reservation.guests.length : undefined,
    });
    const registeredCount = reservation.guests.length;
    const registrationProgress = registrationComplete
      ? null
      : `${registeredCount}/${capacity}`;
    const ownerGuest =
      reservation.guests.find((guest) => guest.isReservationOwner) ??
      reservation.guests.find((guest) => guest.isPrimary);
    const stage = resolveStage({
      registrationComplete,
      integrationConnected,
      lockMapped,
      credentialStatus: credentialRow?.status ?? null,
    });

    return {
      id: reservation.id,
      guestName: resolveReservationDisplayGuestName({
        platform: reservation.platform,
        airbnbEnrichmentGuestName:
          airbnbGuestByReservation.get(reservation.id) ?? null,
        guestName: reservation.guestName,
        primaryGuestName: ownerGuest?.fullName ?? null,
        guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
      }),
      propertyName: reservation.property.name,
      propertyUnitNumber: resolvePropertyUnit({
        name: reservation.property.name,
        unitNumber: reservation.property.unitNumber,
      }),
      propertyType: reservation.property.propertyType,
      checkInTime: reservation.property.checkInTime,
      checkOutTime: reservation.property.checkOutTime,
      checkIn: prismaDateToKey(reservation.checkIn),
      checkOut: prismaDateToKey(reservation.checkOut),
      status: reservation.status,
      registrationComplete,
      registrationCompletedAt:
        reservation.guestRegistrationCompletedAt?.toISOString() ?? null,
      registrationProgress,
      stage,
      stageLabel: STAGE_LABELS[stage],
      credential: credentialRow
        ? {
            id: credentialRow.id,
            status: credentialRow.status,
            code: formatAccessCode(decryptTTLockSecret(credentialRow.codeEncrypted)),
            validFrom: credentialRow.validFrom?.toISOString() ?? null,
            validTo: credentialRow.validTo?.toISOString() ?? null,
            ttlockCodeId: credentialRow.ttlockCodeId,
          }
        : null,
      lockMapped,
      integrationConnected,
    };
  });

  return {
    items,
    metrics: {
      total: items.length,
      awaitingRegistration: items.filter((i) => i.stage === "awaiting_registration")
        .length,
      readyForCode: items.filter(
        (i) =>
          i.stage === "ready_to_generate" || i.stage === "pending_approval",
      ).length,
      codesActive: items.filter(
        (i) => i.stage === "generated" || i.stage === "suspended",
      ).length,
      integrationConnected,
      locksMapped,
    },
  };
}
