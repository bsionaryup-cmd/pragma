import type { WompiIntegration } from "@prisma/client";
import { db } from "@/lib/db";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import type { WompiEnvironment } from "@/modules/billing/config/wompi.config";

export function resolveStoredWompiSecret(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted) return null;
  return decryptTTLockSecret(encrypted);
}

function isWompiSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export function hasWompiIntegrationDelegate(): boolean {
  const client = db as { wompiIntegration?: { findUnique: unknown } };
  return Boolean(client.wompiIntegration?.findUnique);
}

export async function getWompiIntegrationForOrganization(
  organizationId: string,
): Promise<WompiIntegration | null> {
  if (!hasWompiIntegrationDelegate()) return null;
  try {
    return await db.wompiIntegration.findUnique({
      where: { organizationId },
    });
  } catch (error) {
    if (isWompiSchemaMissing(error)) return null;
    throw error;
  }
}

export type SaveWompiCredentialsInput = {
  organizationId: string;
  configuredById: string;
  publicKey: string;
  privateKey?: string;
  eventsSecret?: string;
  integritySecret?: string;
  env: WompiEnvironment;
};

export async function saveWompiCredentialsEncrypted(
  input: SaveWompiCredentialsInput,
): Promise<{ ok: boolean; message: string }> {
  if (!hasWompiIntegrationDelegate()) {
    return {
      ok: false,
      message:
        "Tabla Wompi no disponible. Ejecuta npm run db:migrate:deploy y vuelve a intentar.",
    };
  }

  const existing = await getWompiIntegrationForOrganization(input.organizationId);

  const publicKey = input.publicKey.trim() || existing?.publicKey?.trim() || "";
  if (!publicKey.startsWith("pub_")) {
    return { ok: false, message: "La llave pública debe comenzar con pub_" };
  }

  const privateKeyPlain = input.privateKey?.trim() || null;
  const eventsSecretPlain = input.eventsSecret?.trim() || null;
  const integritySecretPlain = input.integritySecret?.trim() || null;

  const privateKeyEncrypted = privateKeyPlain
    ? encryptTTLockSecret(privateKeyPlain)
    : existing?.privateKeyEncrypted ?? null;
  const eventsSecretEncrypted = eventsSecretPlain
    ? encryptTTLockSecret(eventsSecretPlain)
    : existing?.eventsSecretEncrypted ?? null;
  const integritySecretEncrypted = integritySecretPlain
    ? encryptTTLockSecret(integritySecretPlain)
    : existing?.integritySecretEncrypted ?? null;

  if (!privateKeyEncrypted) {
    return { ok: false, message: "La llave privada es obligatoria" };
  }
  if (!eventsSecretEncrypted) {
    return { ok: false, message: "El secreto de eventos es obligatorio" };
  }
  if (!integritySecretEncrypted) {
    return { ok: false, message: "El secreto de integridad es obligatorio" };
  }

  if (privateKeyPlain && !privateKeyPlain.startsWith("prv_")) {
    return { ok: false, message: "La llave privada debe comenzar con prv_" };
  }

  try {
    await db.wompiIntegration.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        publicKey,
        privateKeyEncrypted,
        eventsSecretEncrypted,
        integritySecretEncrypted,
        env: input.env,
        enabled: true,
        configuredById: input.configuredById,
      },
      update: {
        publicKey,
        privateKeyEncrypted,
        eventsSecretEncrypted,
        integritySecretEncrypted,
        env: input.env,
        configuredById: input.configuredById,
        lastError: null,
      },
    });
    return { ok: true, message: "Credenciales Wompi guardadas de forma segura" };
  } catch (error) {
    if (isWompiSchemaMissing(error)) {
      return {
        ok: false,
        message: "Tabla Wompi no disponible. Ejecuta la migración pendiente.",
      };
    }
    throw error;
  }
}

export async function revokeWompiCredentialsForOrganization(
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!hasWompiIntegrationDelegate()) {
    return { ok: false, message: "Tabla Wompi no disponible" };
  }

  try {
    const row = await getWompiIntegrationForOrganization(organizationId);
    if (!row?.publicKey && !row?.privateKeyEncrypted) {
      return { ok: true, message: "No había credenciales Wompi almacenadas" };
    }

    await db.wompiIntegration.update({
      where: { organizationId },
      data: {
        publicKey: null,
        privateKeyEncrypted: null,
        eventsSecretEncrypted: null,
        integritySecretEncrypted: null,
        enabled: false,
        lastError: null,
      },
    });
    return { ok: true, message: "Credenciales Wompi revocadas del servidor" };
  } catch (error) {
    if (isWompiSchemaMissing(error)) {
      return { ok: false, message: "Tabla Wompi no disponible" };
    }
    throw error;
  }
}

export async function setWompiIntegrationEnabled(
  organizationId: string,
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  if (!hasWompiIntegrationDelegate()) {
    return { ok: false, message: "Tabla Wompi no disponible" };
  }

  const row = await getWompiIntegrationForOrganization(organizationId);
  if (!row?.privateKeyEncrypted || !row.publicKey) {
    return {
      ok: false,
      message: "Configura las credenciales Wompi antes de activar pagos",
    };
  }

  await db.wompiIntegration.update({
    where: { organizationId },
    data: { enabled },
  });

  return {
    ok: true,
    message: enabled
      ? "Pagos Wompi activados"
      : "Pagos Wompi desactivados",
  };
}

export async function recordWompiHealthCheck(
  organizationId: string,
  input: { ok: boolean; message?: string },
): Promise<void> {
  if (!hasWompiIntegrationDelegate()) return;

  try {
    await db.wompiIntegration.update({
      where: { organizationId },
      data: {
        lastHealthCheckAt: new Date(),
        lastError: input.ok ? null : input.message ?? "Error de conexión",
      },
    });
  } catch (error) {
    if (isWompiSchemaMissing(error)) return;
    throw error;
  }
}
