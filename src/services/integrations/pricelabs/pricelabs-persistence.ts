import {
  PriceLabsIntegrationStatus,
  Prisma,
  PropertyPriceLabsSyncStatus,
  PropertyStatus,
  type PriceLabsIntegration,
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
import {
  isPriceLabsSchemaReady,
  isPropertyPriceLabsSchemaReady,
} from "@/services/integrations/pricelabs/pricelabs-schema";

const SINGLETON_ID = "singleton";

export function resolveStoredSecret(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted) return null;
  return decryptTTLockSecret(encrypted);
}

/** @deprecated Use resolveStoredSecret */
export function resolveStoredUserToken(
  encrypted: string | null | undefined,
): string | null {
  return resolveStoredSecret(encrypted);
}

export async function getPriceLabsIntegrationSafe(): Promise<PriceLabsIntegration | null> {
  if (!(await isPriceLabsSchemaReady())) return null;
  try {
    return await db.priceLabsIntegration.findUnique({
      where: { id: SINGLETON_ID },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function ensurePriceLabsIntegration(): Promise<PriceLabsIntegration> {
  if (!(await isPriceLabsSchemaReady())) {
    throw wrapPriceLabsSchemaError({ code: "P2021" });
  }
  try {
    return await db.priceLabsIntegration.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function getPriceLabsIntegration(): Promise<PriceLabsIntegration | null> {
  return getPriceLabsIntegrationSafe();
}

const MIN_API_KEY_LENGTH = 8;

export async function savePriceLabsApiKeyEncrypted(input: {
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

  if (!(await isPriceLabsSchemaReady())) {
    return {
      ok: false,
      message:
        "Tablas PriceLabs no disponibles. Ejecuta npm run db:migrate y vuelve a intentar.",
    };
  }

  try {
    await db.priceLabsIntegration.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        integrationTokenEncrypted: encrypted,
        configuredById: input.configuredById,
        status: PriceLabsIntegrationStatus.PENDING_SETUP,
        lastError: null,
      },
      update: {
        integrationTokenEncrypted: encrypted,
        configuredById: input.configuredById,
        lastError: null,
      },
    });
    return { ok: true, message: "API key guardada de forma segura en el servidor" };
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function revokePriceLabsApiKey(): Promise<{ ok: boolean; message: string }> {
  if (!(await isPriceLabsSchemaReady())) {
    return { ok: false, message: "Tablas PriceLabs no disponibles" };
  }
  try {
    const row = await getPriceLabsIntegrationSafe();
    if (!row?.integrationTokenEncrypted) {
      return { ok: true, message: "No había API key almacenada en base de datos" };
    }
    await db.priceLabsIntegration.update({
      where: { id: SINGLETON_ID },
      data: {
        integrationTokenEncrypted: null,
        status: PriceLabsIntegrationStatus.NOT_CONNECTED,
        lastError: null,
      },
    });
    return { ok: true, message: "API key revocada del servidor" };
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

/** Marks integration row when credentials exist (env and/or DB). */
export async function markPriceLabsIntegrationReady(input: {
  configuredById: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!(await isPriceLabsSchemaReady())) {
    return {
      ok: false,
      message:
        "Tablas PriceLabs no disponibles. Ejecuta npm run db:migrate y vuelve a intentar.",
    };
  }
  try {
    await db.priceLabsIntegration.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        configuredById: input.configuredById,
        status: PriceLabsIntegrationStatus.PENDING_SETUP,
        lastError: null,
      },
      update: {
        configuredById: input.configuredById,
        lastError: null,
      },
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
): Promise<void> {
  if (!(await isPriceLabsSchemaReady())) return;
  try {
    await ensurePriceLabsIntegration();
    await db.priceLabsIntegration.update({
      where: { id: SINGLETON_ID },
      data: {
        neighborhoodSnapshot: snapshot as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return;
    throw wrapPriceLabsSchemaError(error);
  }
}

/** @deprecated API key is env-only (PRICELABS_API_KEY) */
export async function savePriceLabsUserToken(input: {
  configuredById: string;
  userToken: string;
}) {
  void input.userToken;
  const result = await markPriceLabsIntegrationReady({
    configuredById: input.configuredById,
  });
  if (!result.ok) throw new Error(result.message);
  return ensurePriceLabsIntegration();
}

export async function updatePriceLabsIntegrationState(input: {
  status?: PriceLabsIntegrationStatus;
  lastError?: string | null;
  lastHealthCheckAt?: Date | null;
  lastListingsSyncAt?: Date | null;
  lastPricesSyncAt?: Date | null;
}): Promise<PriceLabsIntegration | null> {
  if (!(await isPriceLabsSchemaReady())) return null;
  try {
    await ensurePriceLabsIntegration();
    return await db.priceLabsIntegration.update({
      where: { id: SINGLETON_ID },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
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
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return null;
    throw wrapPriceLabsSchemaError(error);
  }
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
  baseRate: true,
  currency: true,
} as const;

export async function listActivePropertiesForPriceLabs() {
  const includePriceLabs = await isPropertyPriceLabsSchemaReady();

  try {
    if (!includePriceLabs) {
      const rows = await db.property.findMany({
        where: { status: PropertyStatus.ACTIVE },
        orderBy: { name: "asc" },
        select: propertyBaseSelect,
      });
      return rows.map((row) => ({ ...row, priceLabs: null }));
    }

    return await db.property.findMany({
      where: { status: PropertyStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: {
        ...propertyBaseSelect,
        priceLabs: true,
      },
    });
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) {
      const rows = await db.property.findMany({
        where: { status: PropertyStatus.ACTIVE },
        orderBy: { name: "asc" },
        select: propertyBaseSelect,
      });
      return rows.map((row) => ({ ...row, priceLabs: null }));
    }
    throw error;
  }
}

export async function getPropertyForPriceLabs(propertyId: string) {
  const includePriceLabs = await isPropertyPriceLabsSchemaReady();

  try {
    if (!includePriceLabs) {
      const row = await db.property.findFirst({
        where: { id: propertyId, status: PropertyStatus.ACTIVE },
        select: propertyBaseSelect,
      });
      return row ? { ...row, priceLabs: null } : null;
    }

    return await db.property.findFirst({
      where: { id: propertyId, status: PropertyStatus.ACTIVE },
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
