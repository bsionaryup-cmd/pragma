import {
  AccessCredentialStatus,
  AccessEventType,
  ReservationStatus,
  TTLockIntegrationStatus,
} from "@prisma/client";
import { formatAccessCode, formatAccessCodeForLockApi } from "@/lib/access-code";
import { resolveStayScheduleWindow } from "@/lib/stay-schedule";
import { db } from "@/lib/db";
import {
  requestTTLockAddKeyboardPwd,
  requestTTLockChangeKeyboardPwd,
  requestTTLockDeleteKeyboardPwd,
} from "@/services/integrations/ttlock/ttlock-api.client";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import { isTTLockLiveApiEnabled } from "@/services/integrations/ttlock/ttlock-oauth.client";
import {
  resolveOrganizationIdForProperty,
  resolveTTLockIntegrationForProperty,
  resolveTTLockAutomationSettingsForProperty,
} from "@/modules/integrations/ttlock/ttlock.persistence";
import {
  resolveTTLockApiSessionForProperty,
} from "@/modules/integrations/ttlock/ttlock.client";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";
import { beforeAccessCredentialPersist } from "@/services/integrations/ttlock/ttlock-reservation.hooks";

/** Combina fecha de reserva (UTC date) + hora local Colombia para TTLock. */
export function resolveAccessWindow(input: {
  checkIn: Date;
  checkOut: Date;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}): { validFrom: Date; validTo: Date } {
  return resolveStayScheduleWindow(input);
}

function generatePasscode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function resolveAccessTokenForProperty(
  propertyId: string,
): Promise<{
  integrationId: string;
  clientId: string;
  accessToken: string;
  environment: "PRODUCTION" | "SANDBOX";
} | null> {
  const session = await resolveTTLockApiSessionForProperty(propertyId);
  if (!session) return null;
  return {
    integrationId: session.integrationId,
    clientId: session.clientId,
    accessToken: session.accessToken,
    environment: session.environment,
  };
}

const MANAGEABLE_CREDENTIAL_STATUSES: AccessCredentialStatus[] = [
  AccessCredentialStatus.PENDING,
  AccessCredentialStatus.GENERATED,
  AccessCredentialStatus.ACTIVE,
  AccessCredentialStatus.SENT,
  AccessCredentialStatus.SUSPENDED,
];

async function loadManagedAccessCredential(reservationId: string) {
  return db.accessCredential.findFirst({
    where: {
      reservationId,
      status: { in: MANAGEABLE_CREDENTIAL_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: {
      propertyLock: { select: { ttlockLockId: true } },
      reservation: {
        select: {
          propertyId: true,
          checkIn: true,
          checkOut: true,
          property: {
            select: { ownerId: true, checkInTime: true, checkOutTime: true },
          },
        },
      },
    },
  });
}

async function applyAccessWindowUpdate(input: {
  credential: NonNullable<Awaited<ReturnType<typeof loadManagedAccessCredential>>>;
  validFrom: Date;
  validTo: Date;
}): Promise<{ ok: boolean; message: string }> {
  const sync = await syncCredentialWindowOnLock(input);
  if (!sync.ok) {
    return {
      ok: false,
      message: sync.message ?? "No se pudo actualizar la ventana en TTLock",
    };
  }

  await db.accessCredential.update({
    where: { id: input.credential.id },
    data: {
      validFrom: input.validFrom,
      validTo: input.validTo,
    },
  });

  return { ok: true, message: "Ventana de acceso actualizada" };
}

async function syncCredentialWindowOnLock(input: {
  credential: NonNullable<Awaited<ReturnType<typeof loadManagedAccessCredential>>>;
  validFrom: Date;
  validTo: Date;
}): Promise<{ ok: boolean; message?: string }> {
  const { credential, validFrom, validTo } = input;

  if (
    !credential.ttlockCodeId ||
    !credential.propertyLock?.ttlockLockId ||
    !isTTLockLiveApiEnabled()
  ) {
    return { ok: true };
  }

  const apiSession = await resolveAccessTokenForProperty(
    credential.reservation.propertyId,
  );
  if (!apiSession) {
    return { ok: true };
  }

  const lockId = Number.parseInt(credential.propertyLock.ttlockLockId, 10);
  const keyboardPwdId = Number.parseInt(credential.ttlockCodeId, 10);
  if (!Number.isFinite(lockId) || !Number.isFinite(keyboardPwdId)) {
    return { ok: false, message: "ID de cerradura o código TTLock inválido" };
  }

  const result = await requestTTLockChangeKeyboardPwd({
    environment: apiSession.environment,
    clientId: apiSession.clientId,
    accessToken: apiSession.accessToken,
    lockId,
    keyboardPwdId,
    startDate: validFrom.getTime(),
    endDate: validTo.getTime(),
    changeType: 2,
  });

  if (!result.ok) return result;
  return { ok: true };
}

export async function tryGenerateAccessCodeForReservation(
  reservationId: string,
): Promise<GenerateAccessCodeResult | null> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { guestRegistrationCompletedAt: true },
  });
  if (!reservation?.guestRegistrationCompletedAt) return null;
  return generateAccessCodeForReservation(reservationId);
}

export async function syncAccessCodeDatesForReservation(
  reservationId: string,
): Promise<GenerateAccessCodeResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { guestRegistrationCompletedAt: true },
  });

  if (!reservation?.guestRegistrationCompletedAt) {
    return {
      ok: false,
      message: "Registro de huésped pendiente",
    };
  }

  const credential = await loadManagedAccessCredential(reservationId);
  if (!credential) {
    return generateAccessCodeForReservation(reservationId);
  }

  const { validFrom, validTo } = resolveAccessWindow({
    checkIn: credential.reservation.checkIn,
    checkOut: credential.reservation.checkOut,
    checkInTime: credential.reservation.property.checkInTime,
    checkOutTime: credential.reservation.property.checkOutTime,
  });

  const sameWindow =
    credential.validFrom?.getTime() === validFrom.getTime() &&
    credential.validTo?.getTime() === validTo.getTime();

  if (sameWindow) {
    return {
      ok: true,
      message: "Ventana de acceso sin cambios",
      credentialId: credential.id,
    };
  }

  const updated = await applyAccessWindowUpdate({
    credential,
    validFrom,
    validTo,
  });

  return {
    ok: updated.ok,
    message: updated.message,
    credentialId: credential.id,
  };
}

/** Propaga horarios de check-in/out de la propiedad a códigos TTLock activos. */
export async function syncAccessCodeWindowsForProperty(
  propertyId: string,
): Promise<void> {
  const credentials = await db.accessCredential.findMany({
    where: {
      status: {
        in: [
          AccessCredentialStatus.GENERATED,
          AccessCredentialStatus.ACTIVE,
          AccessCredentialStatus.SENT,
          AccessCredentialStatus.SUSPENDED,
        ],
      },
      reservation: {
        propertyId,
        status: { not: ReservationStatus.CANCELLED },
      },
    },
    select: { reservationId: true },
    distinct: ["reservationId"],
  });

  for (const row of credentials) {
    await syncAccessCodeDatesForReservation(row.reservationId);
  }
}

export type GenerateAccessCodeResult = {
  ok: boolean;
  message: string;
  credentialId?: string;
  code?: string;
};

export async function generateAccessCodeForReservation(
  reservationId: string,
  options?: { force?: boolean; skipManualApproval?: boolean },
): Promise<GenerateAccessCodeResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      platform: true,
      guestName: true,
      guestRegistrationCompletedAt: true,
      propertyId: true,
      guests: {
        orderBy: [{ isReservationOwner: "desc" }, { isPrimary: "desc" }],
        take: 1,
        select: { fullName: true, isReservationOwner: true, isPrimary: true },
      },
      property: {
        select: {
          ownerId: true,
          organizationId: true,
          name: true,
          checkInTime: true,
          checkOutTime: true,
          propertyLock: {
            select: {
              id: true,
              ttlockLockId: true,
              integrationId: true,
            },
          },
        },
      },
      accessCredentials: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!reservation) {
    return { ok: false, message: "Reserva no encontrada" };
  }

  if (options?.force) {
    const restored = await restoreRevokedAccessCodeForReservation(reservationId);
    if (restored.ok) return restored;
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return { ok: false, message: "La reserva está cancelada" };
  }

  if (!reservation.guestRegistrationCompletedAt) {
    return {
      ok: false,
      message:
        "El huésped aún no completó el registro. TTLock no generará código hasta entonces.",
    };
  }

  const existing = reservation.accessCredentials[0];
  if (
    existing &&
    !options?.force &&
    (existing.status === AccessCredentialStatus.GENERATED ||
      existing.status === AccessCredentialStatus.ACTIVE ||
      existing.status === AccessCredentialStatus.SENT)
  ) {
    const code = formatAccessCode(decryptTTLockSecret(existing.codeEncrypted));
    return {
      ok: true,
      message: "Ya existe un código activo para esta reserva",
      credentialId: existing.id,
      code: code ?? undefined,
    };
  }

  const propertyLock = reservation.property.propertyLock;
  if (!propertyLock?.ttlockLockId) {
    await db.accessEvent.create({
      data: {
        reservationId: reservation.id,
        eventType: AccessEventType.CODE_GENERATION_READY,
        payload: {
          reason: "property_lock_not_mapped",
          propertyId: reservation.propertyId,
        },
      },
    });
    return {
      ok: false,
      message: "La propiedad no tiene cerradura TTLock vinculada",
    };
  }

  const integration = await resolveTTLockIntegrationForProperty(
    reservation.propertyId,
  );
  const settings = await resolveTTLockAutomationSettingsForProperty(
    reservation.propertyId,
  );

  if (settings?.requireManualApproval && !options?.force && !options?.skipManualApproval) {
    const organizationId =
      reservation.property.organizationId ??
      (await resolveOrganizationIdForProperty(reservation.propertyId));
    const { validFrom, validTo } = resolveAccessWindow({
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      checkInTime: reservation.property.checkInTime,
      checkOutTime: reservation.property.checkOutTime,
    });

    const pending = await db.accessCredential.create({
      data: {
        reservationId: reservation.id,
        organizationId,
        propertyLockId: propertyLock.id,
        status: AccessCredentialStatus.PENDING,
        validFrom,
        validTo,
        type: "GUEST",
      },
    });

    if (integration) {
      await db.accessEvent.create({
        data: {
          reservationId: reservation.id,
          integrationId: integration.id,
          eventType: AccessEventType.CODE_GENERATION_READY,
          payload: { credentialId: pending.id, awaitingApproval: true },
        },
      });
    }

    return {
      ok: true,
      message: "Registro listo. Pendiente de aprobación manual.",
      credentialId: pending.id,
    };
  }

  const airbnbGuestByReservation = await getAirbnbEnrichedGuestNameByReservationIds([
    reservation.id,
  ]);
  const ownerGuest = reservation.guests[0];
  const guestLabel = resolveReservationDisplayGuestName({
    platform: reservation.platform,
    airbnbEnrichmentGuestName: airbnbGuestByReservation.get(reservation.id) ?? null,
    guestName: reservation.guestName,
    primaryGuestName: ownerGuest?.fullName ?? null,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
  });

  const { validFrom, validTo } = resolveAccessWindow({
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    checkInTime: reservation.property.checkInTime,
    checkOutTime: reservation.property.checkOutTime,
  });

  await beforeAccessCredentialPersist({
    reservationId: reservation.id,
    propertyId: reservation.propertyId,
    ownerId: reservation.property.ownerId,
    guestRegistrationCompleted: true,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
  });

  const passcode = generatePasscode();
  const lockPasscode = formatAccessCodeForLockApi(passcode);
  const apiSession = await resolveAccessTokenForProperty(reservation.propertyId);
  let ttlockCodeId: string | null = null;
  let apiMessage: string | null = null;

  if (apiSession && isTTLockLiveApiEnabled()) {
    const lockId = Number.parseInt(propertyLock.ttlockLockId, 10);
    if (!Number.isFinite(lockId)) {
      return { ok: false, message: "ID de cerradura TTLock inválido" };
    }

    const result = await requestTTLockAddKeyboardPwd({
      environment: apiSession.environment,
      clientId: apiSession.clientId,
      accessToken: apiSession.accessToken,
      lockId,
      keyboardPwd: lockPasscode,
      keyboardPwdName: guestLabel.slice(0, 50),
      startDate: validFrom.getTime(),
      endDate: validTo.getTime(),
      addType: 2,
    });

    if (!result.ok) {
      await db.accessEvent.create({
        data: {
          reservationId: reservation.id,
          integrationId: apiSession.integrationId,
          eventType: AccessEventType.LOCK_SYNC_FAILED,
          payload: { step: "keyboardPwd/add", message: result.message },
        },
      });
      return { ok: false, message: result.message };
    }

    ttlockCodeId = String(result.keyboardPwdId);
    apiMessage = "Código enviado a TTLock";
  } else {
    apiMessage = isTTLockLiveApiEnabled()
      ? "Integración TTLock no conectada"
      : "Modo preparación: código generado localmente";
  }

  const organizationId =
    reservation.property.organizationId ??
    (await resolveOrganizationIdForProperty(reservation.propertyId));

  const credential = await db.accessCredential.create({
    data: {
      reservationId: reservation.id,
      organizationId,
      propertyLockId: propertyLock.id,
      ttlockCodeId,
      codeEncrypted: encryptTTLockSecret(lockPasscode),
      validFrom,
      validTo,
      status: AccessCredentialStatus.GENERATED,
      type: "GUEST",
    },
  });

  if (integration) {
    await db.accessEvent.create({
      data: {
        reservationId: reservation.id,
        integrationId: integration.id,
        eventType: AccessEventType.CODE_GENERATED,
        payload: {
          credentialId: credential.id,
          guestLabel,
          ttlockCodeId,
          mode: isTTLockLiveApiEnabled() ? "live_api" : "prepared_without_live_api",
        },
      },
    });
  }

  return {
    ok: true,
    message: apiMessage ?? "Código generado",
    credentialId: credential.id,
    code: formatAccessCode(lockPasscode) ?? undefined,
  };
}

export async function approvePendingAccessCode(
  credentialId: string,
): Promise<GenerateAccessCodeResult> {
  const credential = await db.accessCredential.findUnique({
    where: { id: credentialId },
    select: { reservationId: true, status: true },
  });

  if (!credential) {
    return { ok: false, message: "Credencial no encontrada" };
  }

  if (credential.status !== AccessCredentialStatus.PENDING) {
    return { ok: false, message: "Esta credencial no está pendiente de aprobación" };
  }

  await db.accessCredential.delete({ where: { id: credentialId } });
  return generateAccessCodeForReservation(credential.reservationId, {
    force: true,
  });
}

export async function restoreRevokedAccessCodeForReservation(
  reservationId: string,
): Promise<GenerateAccessCodeResult> {
  const credential = await db.accessCredential.findFirst({
    where: {
      reservationId,
      status: AccessCredentialStatus.REVOKED,
    },
    orderBy: { createdAt: "desc" },
    include: {
      propertyLock: { select: { id: true, ttlockLockId: true } },
      reservation: {
        select: {
          propertyId: true,
          checkIn: true,
          checkOut: true,
          property: { select: { checkInTime: true, checkOutTime: true } },
        },
      },
    },
  });

  if (!credential) {
    return { ok: false, message: "No hay código revocado para restaurar" };
  }

  if (!credential.validFrom || !credential.validTo) {
    return { ok: false, message: "Faltan fechas de validez del código" };
  }

  if (new Date() >= credential.validTo) {
    return { ok: false, message: "La ventana de acceso ya expiró" };
  }

  const lockPasscode = decryptTTLockSecret(credential.codeEncrypted);
  if (!lockPasscode) {
    return { ok: false, message: "No se pudo leer el código almacenado" };
  }

  const propertyLock = credential.propertyLock;
  if (!propertyLock?.ttlockLockId) {
    return { ok: false, message: "La propiedad no tiene cerradura TTLock vinculada" };
  }

  const integration = await resolveTTLockIntegrationForProperty(
    credential.reservation.propertyId,
  );
  let ttlockCodeId = credential.ttlockCodeId;
  let apiMessage = "Código restaurado";

  const apiSession = await resolveAccessTokenForProperty(
    credential.reservation.propertyId,
  );
  if (apiSession && isTTLockLiveApiEnabled()) {
    const lockId = Number.parseInt(propertyLock.ttlockLockId, 10);
    if (!Number.isFinite(lockId)) {
      return { ok: false, message: "ID de cerradura TTLock inválido" };
    }

    const result = await requestTTLockAddKeyboardPwd({
      environment: apiSession.environment,
      clientId: apiSession.clientId,
      accessToken: apiSession.accessToken,
      lockId,
      keyboardPwd: lockPasscode,
      keyboardPwdName: "Restaurado PRAGMA",
      startDate: credential.validFrom.getTime(),
      endDate: credential.validTo.getTime(),
      addType: 2,
    });

    if (!result.ok) {
      return { ok: false, message: result.message };
    }

    ttlockCodeId = String(result.keyboardPwdId);
    apiMessage = "Código restaurado en TTLock";
  }

  await db.accessCredential.update({
    where: { id: credential.id },
    data: {
      status: AccessCredentialStatus.ACTIVE,
      ttlockCodeId,
    },
  });

  if (integration) {
    await db.accessEvent.create({
      data: {
        reservationId,
        integrationId: integration.id,
        eventType: AccessEventType.CODE_GENERATED,
        payload: {
          credentialId: credential.id,
          ttlockCodeId,
          restored: true,
        },
      },
    });
  }

  return {
    ok: true,
    message: apiMessage,
    credentialId: credential.id,
    code: formatAccessCode(lockPasscode) ?? undefined,
  };
}

export async function revokeAccessCodeForReservation(
  reservationId: string,
  options?: { force?: boolean },
): Promise<{ ok: boolean; message: string }> {
  const credential = await loadManagedAccessCredential(reservationId);

  if (!credential) {
    return { ok: true, message: "No había código activo" };
  }

  const { validTo } = resolveAccessWindow({
    checkIn: credential.reservation.checkIn,
    checkOut: credential.reservation.checkOut,
    checkInTime: credential.reservation.property.checkInTime,
    checkOutTime: credential.reservation.property.checkOutTime,
  });

  if (!options?.force && new Date() < validTo) {
    return {
      ok: true,
      message: "El código sigue vigente hasta la hora de checkout",
    };
  }

  if (
    credential.ttlockCodeId &&
    credential.propertyLock?.ttlockLockId &&
    isTTLockLiveApiEnabled()
  ) {
    const apiSession = await resolveAccessTokenForProperty(
      credential.reservation.propertyId,
    );
    if (apiSession) {
      const lockId = Number.parseInt(credential.propertyLock.ttlockLockId, 10);
      const keyboardPwdId = Number.parseInt(credential.ttlockCodeId, 10);
      if (Number.isFinite(lockId) && Number.isFinite(keyboardPwdId)) {
        await requestTTLockDeleteKeyboardPwd({
          environment: apiSession.environment,
          clientId: apiSession.clientId,
          accessToken: apiSession.accessToken,
          lockId,
          keyboardPwdId,
          deleteType: 2,
        });
      }
    }
  }

  await db.accessCredential.update({
    where: { id: credential.id },
    data: { status: AccessCredentialStatus.REVOKED },
  });

  await db.accessEvent.create({
    data: {
      reservationId,
      eventType: AccessEventType.CODE_REVOKED,
      payload: { credentialId: credential.id },
    },
  });

  return { ok: true, message: "Código revocado" };
}

export async function suspendAccessCodeForReservation(
  reservationId: string,
): Promise<{ ok: boolean; message: string }> {
  const credential = await loadManagedAccessCredential(reservationId);

  if (!credential) {
    return { ok: false, message: "No hay código para desactivar" };
  }

  if (
    credential.status !== AccessCredentialStatus.GENERATED &&
    credential.status !== AccessCredentialStatus.ACTIVE &&
    credential.status !== AccessCredentialStatus.SENT
  ) {
    return { ok: false, message: "Este código no se puede desactivar" };
  }

  if (!credential.validFrom || !credential.validTo) {
    return { ok: false, message: "Faltan fechas de validez del código" };
  }

  const now = new Date();
  const sync = await syncCredentialWindowOnLock({
    credential,
    validFrom: credential.validFrom,
    validTo: now,
  });
  if (!sync.ok) {
    return { ok: false, message: sync.message ?? "No se pudo desactivar en TTLock" };
  }

  await db.accessCredential.update({
    where: { id: credential.id },
    data: { status: AccessCredentialStatus.SUSPENDED },
  });

  return { ok: true, message: "Código desactivado temporalmente" };
}

export async function activateAccessCodeForReservation(
  reservationId: string,
): Promise<{ ok: boolean; message: string }> {
  const credential = await loadManagedAccessCredential(reservationId);

  if (!credential) {
    return { ok: false, message: "No hay código para activar" };
  }

  if (credential.status !== AccessCredentialStatus.SUSPENDED) {
    return { ok: false, message: "Este código no está suspendido" };
  }

  if (!credential.validFrom || !credential.validTo) {
    return { ok: false, message: "Faltan fechas de validez del código" };
  }

  const sync = await syncCredentialWindowOnLock({
    credential,
    validFrom: credential.validFrom,
    validTo: credential.validTo,
  });
  if (!sync.ok) {
    return { ok: false, message: sync.message ?? "No se pudo activar en TTLock" };
  }

  await db.accessCredential.update({
    where: { id: credential.id },
    data: { status: AccessCredentialStatus.ACTIVE },
  });

  return { ok: true, message: "Código activado" };
}

export async function processReservationAccessAfterRegistration(input: {
  reservationId: string;
  propertyId: string;
  ownerId: string;
}): Promise<void> {
  const integration = await resolveTTLockIntegrationForProperty(input.propertyId);
  const settings = await resolveTTLockAutomationSettingsForProperty(
    input.propertyId,
  );

  if (integration) {
    await db.accessEvent.create({
      data: {
        reservationId: input.reservationId,
        integrationId: integration.id,
        eventType: AccessEventType.CODE_GENERATION_READY,
        payload: {
          propertyId: input.propertyId,
          guestRegistrationCompleted: true,
        },
      },
    });
  }

  if (settings && settings.generateAfterGuestRegistration === false) {
    return;
  }

  await generateAccessCodeForReservation(input.reservationId, {
    skipManualApproval: true,
  });
}
