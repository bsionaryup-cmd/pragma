import {
  AccessCredentialStatus,
  AccessEventType,
  ReservationStatus,
  TTLockIntegrationStatus,
} from "@prisma/client";
import { prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  requestTTLockAddKeyboardPwd,
  requestTTLockDeleteKeyboardPwd,
} from "@/services/integrations/ttlock/ttlock-api.client";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import { isTTLockLiveApiEnabled } from "@/services/integrations/ttlock/ttlock-oauth.client";
import { ensureTTLockIntegration } from "@/services/integrations/ttlock/ttlock.service";
import { beforeAccessCredentialPersist } from "@/services/integrations/ttlock/ttlock-reservation.hooks";

const BOGOTA_OFFSET_MINUTES = -5 * 60;

function parseTime(value: string | null | undefined, fallback: string): {
  hours: number;
  minutes: number;
} {
  const raw = (value ?? fallback).trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return { hours: 15, minutes: 0 };
  return {
    hours: Number.parseInt(match[1]!, 10),
    minutes: Number.parseInt(match[2]!, 10),
  };
}

/** Combina fecha de reserva (UTC date) + hora local Colombia para TTLock. */
export function resolveAccessWindow(input: {
  checkIn: Date;
  checkOut: Date;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}): { validFrom: Date; validTo: Date } {
  const checkInKey = prismaDateToKey(input.checkIn);
  const checkOutKey = prismaDateToKey(input.checkOut);
  const inTime = parseTime(input.checkInTime, "15:00");
  const outTime = parseTime(input.checkOutTime, "11:00");

  const validFrom = localColombiaDateTime(checkInKey, inTime.hours, inTime.minutes);
  const validTo = localColombiaDateTime(checkOutKey, outTime.hours, outTime.minutes);
  return { validFrom, validTo };
}

function localColombiaDateTime(dateKey: string, hours: number, minutes: number): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utcMs =
    Date.UTC(y, m - 1, d, hours, minutes, 0, 0) -
    BOGOTA_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
}

function generatePasscode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function resolveAccessTokenForOwner(ownerId: string): Promise<{
  integrationId: string;
  clientId: string;
  accessToken: string;
  environment: Awaited<
    ReturnType<typeof ensureTTLockIntegration>
  >["environment"];
} | null> {
  const integration = await ensureTTLockIntegration(ownerId);
  if (
    integration.status !== TTLockIntegrationStatus.CONNECTED &&
    integration.status !== TTLockIntegrationStatus.READY
  ) {
    return null;
  }

  if (!integration.clientId?.trim()) return null;

  let accessToken = decryptTTLockSecret(integration.accessTokenEncrypted);
  if (!accessToken && isTTLockLiveApiEnabled()) {
    return null;
  }
  if (!accessToken) {
    accessToken = "placeholder-token";
  }

  return {
    integrationId: integration.id,
    clientId: integration.clientId,
    accessToken,
    environment: integration.environment,
  };
}

export type GenerateAccessCodeResult = {
  ok: boolean;
  message: string;
  credentialId?: string;
  code?: string;
};

export async function generateAccessCodeForReservation(
  reservationId: string,
  options?: { force?: boolean },
): Promise<GenerateAccessCodeResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestName: true,
      guestFirstName: true,
      guestLastName: true,
      guestRegistrationCompletedAt: true,
      propertyId: true,
      property: {
        select: {
          ownerId: true,
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
    const code = decryptTTLockSecret(existing.codeEncrypted);
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

  const integration = await ensureTTLockIntegration(reservation.property.ownerId);
  const settings = integration.automationSettings;

  if (settings?.requireManualApproval && !options?.force) {
    const { validFrom, validTo } = resolveAccessWindow({
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      checkInTime: reservation.property.checkInTime,
      checkOutTime: reservation.property.checkOutTime,
    });

    const pending = await db.accessCredential.create({
      data: {
        reservationId: reservation.id,
        propertyLockId: propertyLock.id,
        status: AccessCredentialStatus.PENDING,
        validFrom,
        validTo,
      },
    });

    await db.accessEvent.create({
      data: {
        reservationId: reservation.id,
        integrationId: integration.id,
        eventType: AccessEventType.CODE_GENERATION_READY,
        payload: { credentialId: pending.id, awaitingApproval: true },
      },
    });

    return {
      ok: true,
      message: "Registro listo. Pendiente de aprobación manual.",
      credentialId: pending.id,
    };
  }

  const guestLabel =
    reservation.guestName?.trim() ||
    [reservation.guestFirstName, reservation.guestLastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Huésped PRAGMA";

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
  const apiSession = await resolveAccessTokenForOwner(reservation.property.ownerId);
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
      keyboardPwd: passcode,
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

  const credential = await db.accessCredential.create({
    data: {
      reservationId: reservation.id,
      propertyLockId: propertyLock.id,
      ttlockCodeId,
      codeEncrypted: encryptTTLockSecret(passcode),
      validFrom,
      validTo,
      status: AccessCredentialStatus.GENERATED,
    },
  });

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

  return {
    ok: true,
    message: apiMessage ?? "Código generado",
    credentialId: credential.id,
    code: passcode,
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

export async function revokeAccessCodeForReservation(
  reservationId: string,
): Promise<{ ok: boolean; message: string }> {
  const credential = await db.accessCredential.findFirst({
    where: {
      reservationId,
      status: {
        in: [
          AccessCredentialStatus.PENDING,
          AccessCredentialStatus.GENERATED,
          AccessCredentialStatus.ACTIVE,
          AccessCredentialStatus.SENT,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      propertyLock: { select: { ttlockLockId: true } },
      reservation: {
        select: {
          property: { select: { ownerId: true } },
        },
      },
    },
  });

  if (!credential) {
    return { ok: false, message: "No hay código activo para revocar" };
  }

  if (
    credential.ttlockCodeId &&
    credential.propertyLock?.ttlockLockId &&
    isTTLockLiveApiEnabled()
  ) {
    const apiSession = await resolveAccessTokenForOwner(
      credential.reservation.property.ownerId,
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

export async function processReservationAccessAfterRegistration(input: {
  reservationId: string;
  propertyId: string;
  ownerId: string;
}): Promise<void> {
  const integration = await ensureTTLockIntegration(input.ownerId);
  const settings = integration.automationSettings;

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

  if (settings && !settings.generateAfterGuestRegistration) {
    return;
  }

  await generateAccessCodeForReservation(input.reservationId);
}
