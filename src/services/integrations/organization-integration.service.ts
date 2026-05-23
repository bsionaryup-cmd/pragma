import "server-only";

import {
  OrganizationIntegrationProvider,
  OrganizationIntegrationStatus,
  PriceLabsIntegrationStatus,
  type OrganizationIntegration,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import {
  isPriceLabsSchemaDriftError,
  wrapPriceLabsSchemaError,
} from "@/services/integrations/pricelabs/pricelabs-prisma-guard";

const LEGACY_SINGLETON_ID = "singleton";
const MIN_API_KEY_LENGTH = 8;

export function resolveStoredIntegrationSecret(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted?.trim()) return null;
  try {
    return decryptTTLockSecret(encrypted);
  } catch (error) {
    console.error(
      "[organization-integration] decrypt failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const ORG_INTEGRATION_SELECT = {
  id: true,
  organizationId: true,
  provider: true,
  apiKeyEncrypted: true,
  isConnected: true,
  connectedAt: true,
  lastSyncAt: true,
  lastListingsSyncAt: true,
  lastPricesSyncAt: true,
  lastHealthCheckAt: true,
  syncInProgressAt: true,
  status: true,
  lastError: true,
  metadata: true,
  neighborhoodSnapshot: true,
  configuredById: true,
  createdAt: true,
  updatedAt: true,
} as const;

function mapLegacyPriceLabsStatus(
  status: PriceLabsIntegrationStatus,
): OrganizationIntegrationStatus {
  switch (status) {
    case PriceLabsIntegrationStatus.CONNECTED:
      return OrganizationIntegrationStatus.CONNECTED;
    case PriceLabsIntegrationStatus.PENDING_SETUP:
      return OrganizationIntegrationStatus.SYNC_REQUIRED;
    case PriceLabsIntegrationStatus.SYNC_ERROR:
      return OrganizationIntegrationStatus.SYNC_FAILED;
    case PriceLabsIntegrationStatus.DEGRADED:
      return OrganizationIntegrationStatus.DEGRADED;
    default:
      return OrganizationIntegrationStatus.NOT_CONNECTED;
  }
}

async function migrateLegacyPriceLabsRow(
  organizationId: string,
): Promise<OrganizationIntegration | null> {
  try {
    const legacy = await db.priceLabsIntegration.findUnique({
      where: { id: LEGACY_SINGLETON_ID },
      select: {
        integrationTokenEncrypted: true,
        status: true,
        updatedAt: true,
        lastListingsSyncAt: true,
        lastPricesSyncAt: true,
        lastHealthCheckAt: true,
        syncInProgressAt: true,
        lastError: true,
        configuredById: true,
        createdAt: true,
        configuredBy: { select: { organizationId: true } },
      },
    });
    if (
      !legacy?.configuredBy?.organizationId ||
      legacy.configuredBy.organizationId !== organizationId
    ) {
      return null;
    }

    return await db.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: OrganizationIntegrationProvider.PRICELABS,
        },
      },
      create: {
        organizationId,
        provider: OrganizationIntegrationProvider.PRICELABS,
        apiKeyEncrypted: legacy.integrationTokenEncrypted,
        isConnected: legacy.status === PriceLabsIntegrationStatus.CONNECTED,
        connectedAt:
          legacy.status === PriceLabsIntegrationStatus.CONNECTED
            ? legacy.updatedAt
            : null,
        lastSyncAt:
          legacy.lastListingsSyncAt && legacy.lastPricesSyncAt
            ? legacy.lastListingsSyncAt > legacy.lastPricesSyncAt
              ? legacy.lastListingsSyncAt
              : legacy.lastPricesSyncAt
            : legacy.lastListingsSyncAt ?? legacy.lastPricesSyncAt,
        lastListingsSyncAt: legacy.lastListingsSyncAt,
        lastPricesSyncAt: legacy.lastPricesSyncAt,
        lastHealthCheckAt: legacy.lastHealthCheckAt,
        syncInProgressAt: legacy.syncInProgressAt,
        status: mapLegacyPriceLabsStatus(legacy.status),
        lastError: legacy.lastError,
        configuredById: legacy.configuredById,
      },
      update: {},
      select: ORG_INTEGRATION_SELECT,
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function isOrganizationIntegrationSchemaReady(): Promise<boolean> {
  try {
    await db.organizationIntegration.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return false;
    throw error;
  }
}

export async function getOrganizationIntegration(
  organizationId: string,
  provider: OrganizationIntegrationProvider,
): Promise<OrganizationIntegration | null> {
  if (!(await isOrganizationIntegrationSchemaReady())) return null;
  try {
    const row = await db.organizationIntegration.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
      select: ORG_INTEGRATION_SELECT,
    });
    if (row) return row as OrganizationIntegration;
    if (provider !== OrganizationIntegrationProvider.PRICELABS) return null;
    return migrateLegacyPriceLabsRow(organizationId);
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function ensureOrganizationIntegration(input: {
  organizationId: string;
  provider: OrganizationIntegrationProvider;
  configuredById?: string;
}): Promise<OrganizationIntegration> {
  if (!(await isOrganizationIntegrationSchemaReady())) {
    throw wrapPriceLabsSchemaError({ code: "P2021" });
  }
  return db.organizationIntegration.upsert({
    where: {
      organizationId_provider: {
        organizationId: input.organizationId,
        provider: input.provider,
      },
    },
    create: {
      organizationId: input.organizationId,
      provider: input.provider,
      configuredById: input.configuredById ?? null,
    },
    update: {
      ...(input.configuredById ? { configuredById: input.configuredById } : {}),
    },
    select: ORG_INTEGRATION_SELECT,
  }) as Promise<OrganizationIntegration>;
}

export async function saveOrganizationIntegrationApiKey(input: {
  organizationId: string;
  provider: OrganizationIntegrationProvider;
  configuredById: string;
  apiKey: string;
}): Promise<{ ok: boolean; message: string }> {
  const trimmed = input.apiKey.trim();
  if (trimmed.length < MIN_API_KEY_LENGTH) {
    return {
      ok: false,
      message: "La API key debe tener al menos 8 caracteres",
    };
  }

  const encrypted = encryptTTLockSecret(trimmed);
  if (!encrypted) {
    return {
      ok: false,
      message:
        "No se pudo cifrar la API key. Verifica TTLOCK_ENCRYPTION_KEY en el servidor.",
    };
  }

  if (!(await isOrganizationIntegrationSchemaReady())) {
    return {
      ok: false,
      message:
        "Tablas de integración no disponibles. Ejecuta npm run db:migrate:deploy.",
    };
  }

  try {
    await db.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: input.organizationId,
          provider: input.provider,
        },
      },
      create: {
        organizationId: input.organizationId,
        provider: input.provider,
        apiKeyEncrypted: encrypted,
        configuredById: input.configuredById,
        status: OrganizationIntegrationStatus.SYNC_REQUIRED,
        isConnected: false,
        lastError: null,
      },
      update: {
        apiKeyEncrypted: encrypted,
        configuredById: input.configuredById,
        status: OrganizationIntegrationStatus.SYNC_REQUIRED,
        isConnected: false,
        lastError: null,
      },
    });
    return { ok: true, message: "API key guardada de forma segura en el servidor" };
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function disconnectOrganizationIntegration(input: {
  organizationId: string;
  provider: OrganizationIntegrationProvider;
}): Promise<{ ok: boolean; message: string }> {
  if (!(await isOrganizationIntegrationSchemaReady())) {
    return { ok: false, message: "Tablas de integración no disponibles" };
  }
  try {
    const row = await getOrganizationIntegration(
      input.organizationId,
      input.provider,
    );
    if (!row?.apiKeyEncrypted) {
      return { ok: true, message: "PriceLabs ya estaba desconectado" };
    }
    await db.organizationIntegration.update({
      where: {
        organizationId_provider: {
          organizationId: input.organizationId,
          provider: input.provider,
        },
      },
      data: {
        apiKeyEncrypted: null,
        isConnected: false,
        connectedAt: null,
        status: OrganizationIntegrationStatus.NOT_CONNECTED,
        lastError: null,
        syncInProgressAt: null,
      },
    });
    return { ok: true, message: "PriceLabs desconectado" };
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function updateOrganizationIntegrationState(input: {
  organizationId: string;
  provider: OrganizationIntegrationProvider;
  status?: OrganizationIntegrationStatus;
  isConnected?: boolean;
  connectedAt?: Date | null;
  lastError?: string | null;
  lastHealthCheckAt?: Date | null;
  lastListingsSyncAt?: Date | null;
  lastPricesSyncAt?: Date | null;
  lastSyncAt?: Date | null;
  syncInProgressAt?: Date | null;
}): Promise<OrganizationIntegration | null> {
  if (!(await isOrganizationIntegrationSchemaReady())) return null;
  try {
    await ensureOrganizationIntegration({
      organizationId: input.organizationId,
      provider: input.provider,
    });
    return await db.organizationIntegration.update({
      where: {
        organizationId_provider: {
          organizationId: input.organizationId,
          provider: input.provider,
        },
      },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isConnected !== undefined ? { isConnected: input.isConnected } : {}),
        ...(input.connectedAt !== undefined ? { connectedAt: input.connectedAt } : {}),
        ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
        ...(input.lastHealthCheckAt !== undefined
          ? { lastHealthCheckAt: input.lastHealthCheckAt }
          : {}),
        ...(input.lastListingsSyncAt !== undefined
          ? { lastListingsSyncAt: input.lastListingsSyncAt }
          : {}),
        ...(input.lastPricesSyncAt !== undefined
          ? { lastPricesSyncAt: input.lastPricesSyncAt }
          : {}),
        ...(input.lastSyncAt !== undefined ? { lastSyncAt: input.lastSyncAt } : {}),
        ...(input.syncInProgressAt !== undefined
          ? { syncInProgressAt: input.syncInProgressAt }
          : {}),
      },
      select: ORG_INTEGRATION_SELECT,
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function saveOrganizationNeighborhoodSnapshot(input: {
  organizationId: string;
  provider: OrganizationIntegrationProvider;
  snapshot: Record<string, unknown>;
}): Promise<void> {
  if (!(await isOrganizationIntegrationSchemaReady())) return;
  try {
    await ensureOrganizationIntegration({
      organizationId: input.organizationId,
      provider: input.provider,
    });
    await db.organizationIntegration.update({
      where: {
        organizationId_provider: {
          organizationId: input.organizationId,
          provider: input.provider,
        },
      },
      data: {
        neighborhoodSnapshot: input.snapshot as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function resolveOrganizationIntegrationApiKey(input: {
  organizationId: string;
  provider: OrganizationIntegrationProvider;
}): Promise<string | null> {
  const row = await getOrganizationIntegration(
    input.organizationId,
    input.provider,
  );
  return resolveStoredIntegrationSecret(row?.apiKeyEncrypted);
}

export async function listConnectedPriceLabsOrganizations(): Promise<
  Array<{ organizationId: string }>
> {
  if (!(await isOrganizationIntegrationSchemaReady())) return [];
  try {
    const rows = await db.organizationIntegration.findMany({
      where: {
        provider: OrganizationIntegrationProvider.PRICELABS,
        apiKeyEncrypted: { not: null },
        status: {
          in: [
            OrganizationIntegrationStatus.CONNECTED,
            OrganizationIntegrationStatus.SYNC_REQUIRED,
            OrganizationIntegrationStatus.SYNC_FAILED,
            OrganizationIntegrationStatus.DEGRADED,
          ],
        },
      },
      select: { organizationId: true },
    });
    return rows;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return [];
    throw error;
  }
}
