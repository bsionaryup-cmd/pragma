import "server-only";

import {
  AccessCodeType,
  AccessCredentialStatus,
  AccessEventType,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { formatAccessCode, formatAccessCodeForLockApi } from "@/lib/access-code";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { propertyWhere } from "@/lib/platform/tenant-data-scope";
import { formatPropertyLabel } from "@/lib/property-display";
import { resolveTTLockApiSessionForProperty } from "@/modules/integrations/ttlock/ttlock.client";
import {
  requestTTLockAddKeyboardPwd,
  requestTTLockDeleteKeyboardPwd,
} from "@/services/integrations/ttlock/ttlock-api.client";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import { isTTLockLiveApiEnabled } from "@/services/integrations/ttlock/ttlock-oauth.client";
import {
  createOperationalAccessCodeSchema,
  parseOperationalLocalDateTime,
  type CreateOperationalAccessCodeInput,
  validateOperationalAccessWindow,
} from "@/services/integrations/ttlock/operational-access.schema";

const ACTIVE_OPERATIONAL_STATUSES: AccessCredentialStatus[] = [
  AccessCredentialStatus.PENDING,
  AccessCredentialStatus.GENERATED,
  AccessCredentialStatus.ACTIVE,
  AccessCredentialStatus.SENT,
  AccessCredentialStatus.SUSPENDED,
];

export type OperationalAccessPropertyOption = {
  id: string;
  label: string;
  lockAlias: string | null;
  onlineState: "ONLINE" | "OFFLINE" | "UNKNOWN";
};

export type OperationalAccessItem = {
  id: string;
  propertyId: string;
  propertyLabel: string;
  label: string;
  type: AccessCodeType;
  code: string | null;
  validFrom: string;
  validTo: string;
  status: AccessCredentialStatus;
  createdAt: string;
};

export type OperationalAccessOverview = {
  properties: OperationalAccessPropertyOption[];
  credentials: OperationalAccessItem[];
};

export type OperationalAccessMutationResult = {
  ok: boolean;
  message: string;
  credentialId?: string;
  code?: string;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function generateOperationalPasscode(): string {
  return String(randomInt(100000, 1000000));
}

function operationalCredentialWhere(
  scope: TenantDataScope,
  extra: Record<string, unknown> = {},
) {
  return {
    ...extra,
    property: propertyWhere(scope),
  };
}

export async function getOperationalAccessOverview(
  scope: TenantDataScope,
): Promise<OperationalAccessOverview> {
  const now = new Date();
  const [properties, credentials] = await Promise.all([
    db.property.findMany({
      where: {
        ...propertyWhere(scope),
        status: "ACTIVE",
        propertyLock: {
          is: {
            ttlockLockId: { not: null },
            integration: {
              isActive: true,
              status: { in: ["CONNECTED", "READY", "SYNC_ERROR"] },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        unitNumber: true,
        propertyLock: {
          select: { alias: true, onlineState: true },
        },
      },
      orderBy: [{ unitNumber: "asc" }, { name: "asc" }],
    }),
    db.operationalAccessCredential.findMany({
      where: operationalCredentialWhere(scope, {
        OR: [
          { status: { in: ACTIVE_OPERATIONAL_STATUSES } },
          { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      }),
      include: {
        property: {
          select: { name: true, unitNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return {
    properties: properties.map((property) => ({
      id: property.id,
      label: formatPropertyLabel(property),
      lockAlias: property.propertyLock?.alias ?? null,
      onlineState: property.propertyLock?.onlineState ?? "UNKNOWN",
    })),
    credentials: credentials.map((credential) => {
      const synchronized = Boolean(credential.ttlockCodeId);
      const visibleStatus =
        synchronized &&
        credential.validTo <= now &&
        credential.status !== AccessCredentialStatus.REVOKED
          ? AccessCredentialStatus.EXPIRED
          : credential.status;
      return {
        id: credential.id,
        propertyId: credential.propertyId,
        propertyLabel: formatPropertyLabel(credential.property),
        label: credential.label,
        type: credential.type,
        code:
          synchronized &&
          visibleStatus !== AccessCredentialStatus.REVOKED &&
          visibleStatus !== AccessCredentialStatus.EXPIRED
            ? formatAccessCode(
                decryptTTLockSecret(credential.codeEncrypted),
              )
            : null,
        validFrom: credential.validFrom.toISOString(),
        validTo: credential.validTo.toISOString(),
        status: visibleStatus,
        createdAt: credential.createdAt.toISOString(),
      };
    }),
  };
}

async function loadExistingIdempotentCredential(
  idempotencyKey: string,
  scope: TenantDataScope,
): Promise<OperationalAccessMutationResult | null> {
  const existing = await db.operationalAccessCredential.findFirst({
    where: operationalCredentialWhere(scope, { idempotencyKey }),
  });
  if (!existing) return null;

  if (
    existing.ttlockCodeId &&
    (existing.status === AccessCredentialStatus.GENERATED ||
      existing.status === AccessCredentialStatus.ACTIVE ||
      existing.status === AccessCredentialStatus.SENT)
  ) {
    const code = formatAccessCode(decryptTTLockSecret(existing.codeEncrypted));
    return {
      ok: true,
      message: "El código operativo ya había sido creado",
      credentialId: existing.id,
      code: code ?? undefined,
    };
  }

  return {
    ok: false,
    message:
      existing.status === AccessCredentialStatus.PENDING
        ? "La creación del código ya está en proceso"
        : existing.lastError ?? "La solicitud anterior no pudo completarse",
    credentialId: existing.id,
  };
}

export async function createOperationalAccessCode(
  rawInput: CreateOperationalAccessCodeInput,
  scope: TenantDataScope,
  createdById: string,
): Promise<OperationalAccessMutationResult> {
  const parsed = createOperationalAccessCodeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const existing = await loadExistingIdempotentCredential(
    parsed.data.idempotencyKey,
    scope,
  );
  if (existing) return existing;

  const validFrom = parseOperationalLocalDateTime(
    parsed.data.validFromLocal,
  );
  const validTo = parseOperationalLocalDateTime(parsed.data.validToLocal);
  if (!validFrom || !validTo) {
    return { ok: false, message: "Fecha y hora inválidas" };
  }
  const windowValidation = validateOperationalAccessWindow({
    validFrom,
    validTo,
  });
  if (!windowValidation.ok) return windowValidation;

  const property = await db.property.findFirst({
    where: { id: parsed.data.propertyId, ...propertyWhere(scope) },
    select: {
      id: true,
      organizationId: true,
      propertyLock: {
        select: {
          id: true,
          ttlockLockId: true,
          integrationId: true,
        },
      },
    },
  });
  if (!property) {
    return { ok: false, message: "Propiedad no encontrada" };
  }
  if (!property.propertyLock?.ttlockLockId) {
    return {
      ok: false,
      message: "La propiedad no tiene una cerradura TTLock vinculada",
    };
  }
  if (!isTTLockLiveApiEnabled()) {
    return {
      ok: false,
      message: "La API TTLock está deshabilitada; no se creó ningún código",
    };
  }

  const session = await resolveTTLockApiSessionForProperty(property.id);
  if (!session || session.accessToken === "placeholder-token") {
    return {
      ok: false,
      message: "La integración TTLock no está conectada o su sesión venció",
    };
  }

  const lockId = Number.parseInt(property.propertyLock.ttlockLockId, 10);
  if (!Number.isFinite(lockId)) {
    return { ok: false, message: "ID de cerradura TTLock inválido" };
  }

  const passcode =
    parsed.data.customCode || generateOperationalPasscode();
  const encrypted = encryptTTLockSecret(passcode);
  if (!encrypted) {
    return { ok: false, message: "No se pudo proteger el código de acceso" };
  }

  let claim: { id: string };
  try {
    claim = await db.operationalAccessCredential.create({
      data: {
        organizationId: scope.organizationId ?? property.organizationId,
        propertyId: property.id,
        propertyLockId: property.propertyLock.id,
        createdById,
        idempotencyKey: parsed.data.idempotencyKey,
        label: parsed.data.label,
        type: parsed.data.type,
        codeEncrypted: encrypted,
        validFrom,
        validTo,
        status: AccessCredentialStatus.PENDING,
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return (
        (await loadExistingIdempotentCredential(
          parsed.data.idempotencyKey,
          scope,
        )) ?? {
          ok: false,
          message: "No se pudo recuperar la solicitud existente",
        }
      );
    }
    throw error;
  }

  const result = await requestTTLockAddKeyboardPwd({
    environment: session.environment,
    clientId: session.clientId,
    accessToken: session.accessToken,
    lockId,
    keyboardPwd: formatAccessCodeForLockApi(passcode),
    keyboardPwdName: parsed.data.label.slice(0, 50),
    startDate: validFrom.getTime(),
    endDate: validTo.getTime(),
    addType: 2,
  });

  if (!result.ok) {
    await Promise.all([
      db.operationalAccessCredential.deleteMany({
        where: { id: claim.id, status: AccessCredentialStatus.PENDING },
      }),
      db.accessEvent.create({
        data: {
          integrationId: property.propertyLock.integrationId,
          eventType: AccessEventType.LOCK_SYNC_FAILED,
          payload: {
            source: "operational_access",
            operation: "create",
            propertyId: property.id,
            label: parsed.data.label,
            message: result.message,
          },
        },
      }),
    ]);
    return { ok: false, message: result.message };
  }

  try {
    await db.$transaction([
      db.operationalAccessCredential.update({
        where: { id: claim.id },
        data: {
          ttlockCodeId: String(result.keyboardPwdId),
          status: AccessCredentialStatus.GENERATED,
          lastError: null,
        },
      }),
      db.accessEvent.create({
        data: {
          integrationId: property.propertyLock.integrationId,
          eventType: AccessEventType.CODE_GENERATED,
          payload: {
            source: "operational_access",
            credentialId: claim.id,
            propertyId: property.id,
            label: parsed.data.label,
            type: parsed.data.type,
            validFrom,
            validTo,
            createdById,
            ttlockCodeId: String(result.keyboardPwdId),
          },
        },
      }),
    ]);
  } catch (persistError) {
    const compensation = await requestTTLockDeleteKeyboardPwd({
      environment: session.environment,
      clientId: session.clientId,
      accessToken: session.accessToken,
      lockId,
      keyboardPwdId: result.keyboardPwdId,
      deleteType: 2,
    });
    if (compensation.ok) {
      await db.operationalAccessCredential.deleteMany({
        where: { id: claim.id },
      });
    } else {
      await db.operationalAccessCredential.updateMany({
        where: { id: claim.id },
        data: {
          ttlockCodeId: String(result.keyboardPwdId),
          status: AccessCredentialStatus.REVOKED,
          lastError: `persist_failed; compensation_failed: ${compensation.message}`,
        },
      });
    }
    throw persistError;
  }

  return {
    ok: true,
    message: "Código operativo creado en TTLock",
    credentialId: claim.id,
    code: formatAccessCode(passcode) ?? undefined,
  };
}

export async function revokeOperationalAccessCode(
  credentialId: string,
  scope: TenantDataScope,
  revokedById: string,
): Promise<OperationalAccessMutationResult> {
  const credential = await db.operationalAccessCredential.findFirst({
    where: operationalCredentialWhere(scope, { id: credentialId }),
    include: {
      propertyLock: {
        select: {
          ttlockLockId: true,
          integrationId: true,
        },
      },
    },
  });
  if (!credential) {
    return { ok: false, message: "Código operativo no encontrado" };
  }
  if (
    credential.status === AccessCredentialStatus.REVOKED ||
    credential.status === AccessCredentialStatus.EXPIRED
  ) {
    return { ok: true, message: "El código ya no está activo" };
  }
  if (
    !credential.ttlockCodeId ||
    !credential.propertyLock.ttlockLockId
  ) {
    return {
      ok: false,
      message: "El código no tiene una referencia TTLock válida",
    };
  }
  if (!isTTLockLiveApiEnabled()) {
    return {
      ok: false,
      message: "La API TTLock está deshabilitada; el código no fue revocado",
    };
  }

  const session = await resolveTTLockApiSessionForProperty(
    credential.propertyId,
  );
  if (!session || session.accessToken === "placeholder-token") {
    return {
      ok: false,
      message: "La integración TTLock no está conectada o su sesión venció",
    };
  }

  const lockId = Number.parseInt(
    credential.propertyLock.ttlockLockId,
    10,
  );
  const keyboardPwdId = Number.parseInt(credential.ttlockCodeId, 10);
  if (!Number.isFinite(lockId) || !Number.isFinite(keyboardPwdId)) {
    return { ok: false, message: "Referencia TTLock inválida" };
  }

  const result = await requestTTLockDeleteKeyboardPwd({
    environment: session.environment,
    clientId: session.clientId,
    accessToken: session.accessToken,
    lockId,
    keyboardPwdId,
    deleteType: 2,
  });
  if (!result.ok) return result;

  await db.$transaction([
    db.operationalAccessCredential.update({
      where: { id: credential.id },
      data: {
        status: AccessCredentialStatus.REVOKED,
        revokedAt: new Date(),
        lastError: null,
      },
    }),
    db.accessEvent.create({
      data: {
        integrationId: credential.propertyLock.integrationId,
        eventType: AccessEventType.CODE_REVOKED,
        payload: {
          source: "operational_access",
          credentialId: credential.id,
          propertyId: credential.propertyId,
          label: credential.label,
          revokedById,
          ttlockCodeId: credential.ttlockCodeId,
        },
      },
    }),
  ]);

  return { ok: true, message: "Código operativo revocado en TTLock" };
}

export type PurgeExpiredOperationalAccessResult = {
  scanned: number;
  deletedFromTtlock: number;
  markedExpired: number;
  errors: string[];
};

export async function purgeExpiredOperationalAccessCodes(options?: {
  limit?: number;
}): Promise<PurgeExpiredOperationalAccessResult> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const now = new Date();
  const summary: PurgeExpiredOperationalAccessResult = {
    scanned: 0,
    deletedFromTtlock: 0,
    markedExpired: 0,
    errors: [],
  };
  const credentials = await db.operationalAccessCredential.findMany({
    where: {
      status: { in: ACTIVE_OPERATIONAL_STATUSES },
      validTo: { lt: now },
      ttlockCodeId: { not: null },
    },
    include: {
      propertyLock: {
        select: { ttlockLockId: true, integrationId: true },
      },
    },
    orderBy: { validTo: "asc" },
    take: limit,
  });

  for (const credential of credentials) {
    summary.scanned += 1;
    const lockId = Number.parseInt(
      credential.propertyLock.ttlockLockId ?? "",
      10,
    );
    const keyboardPwdId = Number.parseInt(
      credential.ttlockCodeId ?? "",
      10,
    );
    if (!Number.isFinite(lockId) || !Number.isFinite(keyboardPwdId)) {
      summary.errors.push(`${credential.id}: referencia TTLock inválida`);
      continue;
    }
    const session = await resolveTTLockApiSessionForProperty(
      credential.propertyId,
    );
    if (!session || session.accessToken === "placeholder-token") {
      summary.errors.push(`${credential.id}: sesión TTLock no disponible`);
      continue;
    }
    const result = await requestTTLockDeleteKeyboardPwd({
      environment: session.environment,
      clientId: session.clientId,
      accessToken: session.accessToken,
      lockId,
      keyboardPwdId,
      deleteType: 2,
    });
    if (!result.ok) {
      summary.errors.push(`${credential.id}: ${result.message}`);
      await db.operationalAccessCredential.update({
        where: { id: credential.id },
        data: { lastError: result.message.slice(0, 1000) },
      });
      continue;
    }

    summary.deletedFromTtlock += 1;
    await db.$transaction([
      db.operationalAccessCredential.update({
        where: { id: credential.id },
        data: {
          status: AccessCredentialStatus.EXPIRED,
          lastError: null,
        },
      }),
      db.accessEvent.create({
        data: {
          integrationId: credential.propertyLock.integrationId,
          eventType: AccessEventType.CODE_REVOKED,
          payload: {
            source: "operational_access",
            operation: "expire",
            credentialId: credential.id,
            propertyId: credential.propertyId,
            ttlockCodeId: credential.ttlockCodeId,
          },
        },
      }),
    ]);
    summary.markedExpired += 1;
  }

  return summary;
}

