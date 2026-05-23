import {
  AccessCredentialStatus,
  ReservationStatus,
} from "@prisma/client";
import { formatPropertyLabel, sortPropertiesByUnitNumber } from "@/lib/property-display";
import { formatAccessCode } from "@/lib/access-code";
import { prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
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
  awaiting_registration: "Esperando registro del huésped",
  awaiting_integration: "TTLock no conectado",
  awaiting_lock: "Sin cerradura vinculada",
  pending_approval: "Pendiente de aprobación",
  ready_to_generate: "Listo para generar código",
  generated: "Código generado",
  suspended: "Código suspendido",
  revoked: "Código revocado",
  expired: "Código expirado",
};

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
    },
    orderBy: { checkIn: "asc" },
    take: 80,
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestName: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          maxGuests: true,
          propertyLock: { select: { id: true } },
        },
      },
      guests: {
        where: {
          status: {
            in: ["REGISTERED", "VERIFIED", "CHECKED_IN", "CHECKED_OUT"],
          },
        },
        select: { id: true },
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

  const sortedReservations = sortPropertiesByUnitNumber(
    reservations,
    (reservation) => reservation.property,
  );

  const items: SmartAccessItem[] = sortedReservations.map((reservation) => {
    const credentialRow = reservation.accessCredentials[0] ?? null;
    const lockMapped = Boolean(reservation.property.propertyLock);
    const registrationComplete = Boolean(reservation.guestRegistrationCompletedAt);
    const capacity = Math.max(1, reservation.property.maxGuests);
    const registeredCount = reservation.guests.length;
    const registrationProgress = registrationComplete
      ? null
      : `${registeredCount}/${capacity}`;
    const stage = resolveStage({
      registrationComplete,
      integrationConnected,
      lockMapped,
      credentialStatus: credentialRow?.status ?? null,
    });

    return {
      id: reservation.id,
      guestName: reservation.guestName?.trim() || "Sin registrar",
      propertyName: formatPropertyLabel(reservation.property),
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
