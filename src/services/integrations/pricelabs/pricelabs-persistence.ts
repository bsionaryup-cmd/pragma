import {
  OrganizationIntegrationProvider,
  OrganizationIntegrationStatus,
  Prisma,
  PropertyPriceLabsSyncStatus,
  PropertyStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  mergePropertyScope,
  propertyWhere,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  disconnectOrganizationIntegration,
  ensureOrganizationIntegration,
  getOrganizationIntegration,
  isOrganizationIntegrationSchemaReady,
  resolveOrganizationIntegrationApiKey,
  resolveStoredIntegrationSecret,
  saveOrganizationIntegrationApiKey,
  saveOrganizationNeighborhoodSnapshot,
  updateOrganizationIntegrationState,
} from "@/services/integrations/organization-integration.service";
import {
  isPriceLabsSchemaDriftError,
  wrapPriceLabsSchemaError,
} from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { requirePriceLabsOrganizationId } from "@/services/integrations/pricelabs/pricelabs-org-context";
import {
  isPropertyPriceLabsSchemaReady,
} from "@/services/integrations/pricelabs/pricelabs-schema";

export { resolveStoredIntegrationSecret as resolveStoredSecret } from "@/services/integrations/organization-integration.service";

/** @deprecated Use resolveStoredSecret */
export function resolveStoredUserToken(
  encrypted: string | null | undefined,
): string | null {
  return resolveStoredIntegrationSecret(encrypted);
}

const PRICELABS = OrganizationIntegrationProvider.PRICELABS;

export async function getPriceLabsOrgIntegration(organizationId: string) {
  return getOrganizationIntegration(organizationId, PRICELABS);
}

/** @deprecated singleton — use getPriceLabsOrgIntegration */
export async function getPriceLabsIntegrationSafe() {
  const organizationId = requirePriceLabsOrganizationId();
  return getPriceLabsOrgIntegration(organizationId);
}

export async function ensurePriceLabsIntegration(organizationId?: string) {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  return ensureOrganizationIntegration({
    organizationId: orgId,
    provider: PRICELABS,
  });
}

/** @deprecated */
export async function getPriceLabsIntegration() {
  return getPriceLabsIntegrationSafe();
}

export async function resolvePriceLabsTenantScope(
  scope?: TenantDataScope,
): Promise<TenantDataScope> {
  if (scope) return scope;
  return requireTenantDataScope();
}

export async function savePriceLabsApiKeyEncrypted(input: {
  configuredById: string;
  organizationId: string;
  apiKey: string;
}): Promise<{ ok: boolean; message: string }> {
  return saveOrganizationIntegrationApiKey({
    organizationId: input.organizationId,
    provider: PRICELABS,
    configuredById: input.configuredById,
    apiKey: input.apiKey,
  });
}

export async function revokePriceLabsApiKey(
  organizationId?: string,
): Promise<{ ok: boolean; message: string }> {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  return disconnectOrganizationIntegration({
    organizationId: orgId,
    provider: PRICELABS,
  });
}

export async function markPriceLabsIntegrationReady(input: {
  configuredById: string;
  organizationId: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!(await isOrganizationIntegrationSchemaReady())) {
    return {
      ok: false,
      message:
        "Tablas de integración no disponibles. Ejecuta npm run db:migrate:deploy.",
    };
  }
  try {
    await ensureOrganizationIntegration({
      organizationId: input.organizationId,
      provider: PRICELABS,
      configuredById: input.configuredById,
    });
    await updateOrganizationIntegrationState({
      organizationId: input.organizationId,
      provider: PRICELABS,
      status: OrganizationIntegrationStatus.SYNC_REQUIRED,
      lastError: null,
    });
    return {
      ok: true,
      message: "Integración preparada para sincronización",
    };
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function saveNeighborhoodSnapshot(
  snapshot: Record<string, unknown>,
  organizationId?: string,
): Promise<void> {
  const orgId = organizationId ?? requirePriceLabsOrganizationId();
  await saveOrganizationNeighborhoodSnapshot({
    organizationId: orgId,
    provider: PRICELABS,
    snapshot,
  });
}

/** @deprecated */
export async function savePriceLabsUserToken(input: {
  configuredById: string;
  userToken: string;
  organizationId: string;
}) {
  void input.userToken;
  const result = await markPriceLabsIntegrationReady({
    configuredById: input.configuredById,
    organizationId: input.organizationId,
  });
  if (!result.ok) throw new Error(result.message);
  return ensurePriceLabsIntegration(input.organizationId);
}

export async function updatePriceLabsIntegrationState(input: {
  status?: OrganizationIntegrationStatus;
  isConnected?: boolean;
  connectedAt?: Date | null;
  lastError?: string | null;
  lastHealthCheckAt?: Date | null;
  lastListingsSyncAt?: Date | null;
  lastPricesSyncAt?: Date | null;
  lastSyncAt?: Date | null;
  syncInProgressAt?: Date | null;
  organizationId?: string;
}) {
  const orgId = input.organizationId ?? requirePriceLabsOrganizationId();
  return updateOrganizationIntegrationState({
    organizationId: orgId,
    provider: PRICELABS,
    status: input.status,
    isConnected: input.isConnected,
    connectedAt: input.connectedAt,
    lastError: input.lastError,
    lastHealthCheckAt: input.lastHealthCheckAt,
    lastListingsSyncAt: input.lastListingsSyncAt,
    lastPricesSyncAt: input.lastPricesSyncAt,
    lastSyncAt: input.lastSyncAt,
    syncInProgressAt: input.syncInProgressAt,
  });
}

export async function resolvePriceLabsApiKeyForOrg(
  organizationId: string,
): Promise<string | null> {
  return resolveOrganizationIntegrationApiKey({
    organizationId,
    provider: PRICELABS,
  });
}

const propertyBaseSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  country: true,
  maxGuests: true,
  bedrooms: true,
  bathrooms: true,
  unitNumber: true,
  baseRate: true,
  currency: true,
} as const;

export async function listActivePropertiesForPriceLabs(scope: TenantDataScope) {
  const includePriceLabs = await isPropertyPriceLabsSchemaReady();
  const propertyFilter = mergePropertyScope(scope, {
    status: PropertyStatus.ACTIVE,
  });

  try {
    if (!includePriceLabs) {
      const rows = await db.property.findMany({
        where: propertyFilter,
        orderBy: { name: "asc" },
        select: propertyBaseSelect,
      });
      return rows.map((row) => ({ ...row, priceLabs: null }));
    }

    return await db.property.findMany({
      where: propertyFilter,
      orderBy: { name: "asc" },
      select: {
        ...propertyBaseSelect,
        priceLabs: true,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) {
      const rows = await db.property.findMany({
        where: propertyFilter,
        orderBy: { name: "asc" },
        select: propertyBaseSelect,
      });
      return rows.map((row) => ({ ...row, priceLabs: null }));
    }
    throw error;
  }
}

export async function getPropertyForPriceLabs(
  propertyId: string,
  scope: TenantDataScope,
) {
  const includePriceLabs = await isPropertyPriceLabsSchemaReady();
  const propertyFilter = {
    id: propertyId,
    status: PropertyStatus.ACTIVE,
    ...propertyWhere(scope),
  };

  try {
    if (!includePriceLabs) {
      const row = await db.property.findFirst({
        where: propertyFilter,
        select: propertyBaseSelect,
      });
      return row ? { ...row, priceLabs: null } : null;
    }

    return await db.property.findFirst({
      where: propertyFilter,
      select: {
        ...propertyBaseSelect,
        priceLabs: true,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function upsertPropertyPriceLabsSync(input: {
  propertyId: string;
  listingId: string;
  recommendedRate?: number | null;
  baseRateAtSync?: number | null;
  priceDelta?: number | null;
  weekendUpliftPct?: number | null;
  syncStatus: PropertyPriceLabsSyncStatus;
  lastError?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  if (!(await isPropertyPriceLabsSchemaReady())) {
    return null;
  }

  const metaValue: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
    input.meta === null
      ? Prisma.JsonNull
      : input.meta
        ? (input.meta as Prisma.InputJsonValue)
        : undefined;

  try {
    return await db.propertyPriceLabs.upsert({
      where: { propertyId: input.propertyId },
      create: {
        propertyId: input.propertyId,
        listingId: input.listingId,
        recommendedRate: input.recommendedRate ?? null,
        baseRateAtSync: input.baseRateAtSync ?? null,
        priceDelta: input.priceDelta ?? null,
        weekendUpliftPct: input.weekendUpliftPct ?? null,
        syncStatus: input.syncStatus,
        lastSyncedAt: new Date(),
        lastError: input.lastError ?? null,
        meta: metaValue,
      },
      update: {
        listingId: input.listingId,
        recommendedRate: input.recommendedRate ?? null,
        baseRateAtSync: input.baseRateAtSync ?? null,
        priceDelta: input.priceDelta ?? null,
        weekendUpliftPct: input.weekendUpliftPct ?? null,
        syncStatus: input.syncStatus,
        lastSyncedAt: new Date(),
        lastError: input.lastError ?? null,
        meta: metaValue,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function markPropertyPriceLabsError(
  propertyId: string,
  message: string,
) {
  if (!(await isPropertyPriceLabsSchemaReady())) {
    return null;
  }

  try {
    return await db.propertyPriceLabs.upsert({
      where: { propertyId },
      create: {
        propertyId,
        syncStatus: PropertyPriceLabsSyncStatus.ERROR,
        lastError: message,
        lastSyncedAt: new Date(),
      },
      update: {
        syncStatus: PropertyPriceLabsSyncStatus.ERROR,
        lastError: message,
        lastSyncedAt: new Date(),
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw wrapPriceLabsSchemaError(error);
  }
}
