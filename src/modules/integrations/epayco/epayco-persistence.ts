import type { EpaycoIntegration } from "@prisma/client";
import { db } from "@/lib/db";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import type { EpaycoEnvironment } from "@/modules/integrations/epayco/epayco.config";

export function resolveStoredEpaycoSecret(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted) return null;
  return decryptTTLockSecret(encrypted);
}

function isEpaycoSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export function hasEpaycoIntegrationDelegate(): boolean {
  const client = db as { epaycoIntegration?: { findUnique: unknown } };
  return Boolean(client.epaycoIntegration?.findUnique);
}

export async function getEpaycoIntegrationForOrganization(
  organizationId: string,
): Promise<EpaycoIntegration | null> {
  if (!hasEpaycoIntegrationDelegate()) return null;
  try {
    return await db.epaycoIntegration.findUnique({
      where: { organizationId },
    });
  } catch (error) {
    if (isEpaycoSchemaMissing(error)) return null;
    throw error;
  }
}

export type SaveEpaycoCredentialsInput = {
  organizationId: string;
  configuredById: string;
  publicKey: string;
  privateKey?: string;
  pKey?: string;
  custIdCliente?: string;
  env: EpaycoEnvironment;
  preferForGuestPayments?: boolean;
};

export async function saveEpaycoCredentialsEncrypted(
  input: SaveEpaycoCredentialsInput,
): Promise<{ ok: boolean; message: string }> {
  if (!hasEpaycoIntegrationDelegate()) {
    return {
      ok: false,
      message:
        "Tabla ePayco no disponible. Ejecuta npm run db:migrate:deploy y vuelve a intentar.",
    };
  }

  const existing = await getEpaycoIntegrationForOrganization(input.organizationId);
  const publicKey = input.publicKey.trim() || existing?.publicKey?.trim() || "";
  if (!publicKey) {
    return { ok: false, message: "La llave pública es obligatoria" };
  }

  const privateKeyPlain = input.privateKey?.trim() || null;
  const pKeyPlain = input.pKey?.trim() || null;

  const privateKeyEncrypted = privateKeyPlain
    ? encryptTTLockSecret(privateKeyPlain)
    : existing?.privateKeyEncrypted ?? null;
  const pKeyEncrypted = pKeyPlain
    ? encryptTTLockSecret(pKeyPlain)
    : existing?.pKeyEncrypted ?? null;

  if (!privateKeyEncrypted) {
    return { ok: false, message: "La llave privada es obligatoria" };
  }
  if (!pKeyEncrypted) {
    return { ok: false, message: "La P_KEY de confirmación es obligatoria" };
  }

  const custIdCliente =
    input.custIdCliente?.trim() || existing?.custIdCliente?.trim() || null;

  try {
    await db.epaycoIntegration.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        publicKey,
        privateKeyEncrypted,
        pKeyEncrypted,
        custIdCliente,
        env: input.env,
        enabled: true,
        preferForGuestPayments: input.preferForGuestPayments ?? false,
        configuredById: input.configuredById,
      },
      update: {
        publicKey,
        privateKeyEncrypted,
        pKeyEncrypted,
        custIdCliente,
        env: input.env,
        preferForGuestPayments:
          input.preferForGuestPayments ?? existing?.preferForGuestPayments ?? false,
        configuredById: input.configuredById,
        lastError: null,
      },
    });
    return { ok: true, message: "Credenciales ePayco guardadas" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo guardar ePayco",
    };
  }
}

export async function revokeEpaycoCredentialsForOrganization(
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!hasEpaycoIntegrationDelegate()) {
    return { ok: false, message: "Integración ePayco no disponible" };
  }
  await db.epaycoIntegration.deleteMany({ where: { organizationId } });
  return { ok: true, message: "Credenciales ePayco eliminadas" };
}

export async function setEpaycoIntegrationEnabled(
  organizationId: string,
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (!hasEpaycoIntegrationDelegate()) {
    return { ok: false, message: "Integración ePayco no disponible" };
  }
  const updated = await db.epaycoIntegration.updateMany({
    where: { organizationId },
    data: { enabled },
  });
  if (updated.count === 0) {
    return { ok: false, message: "Configura ePayco antes de activar" };
  }
  return { ok: true, message: enabled ? "ePayco activado" : "ePayco desactivado" };
}
