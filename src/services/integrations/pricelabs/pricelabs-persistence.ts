import {
  PriceLabsIntegrationStatus,
  Prisma,
  PropertyPriceLabsSyncStatus,
  PropertyStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  decryptTTLockSecret,
  encryptTTLockSecret,
} from "@/services/integrations/ttlock/ttlock-crypto";
import { wrapPriceLabsSchemaError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";

const SINGLETON_ID = "singleton";

export async function ensurePriceLabsIntegration() {
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

export async function getPriceLabsIntegration() {
  try {
    return await db.priceLabsIntegration.findUnique({
      where: { id: SINGLETON_ID },
    });
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function savePriceLabsUserToken(input: {
  configuredById: string;
  userToken: string;
}) {
  try {
    return await db.priceLabsIntegration.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        configuredById: input.configuredById,
        userTokenEncrypted: encryptTTLockSecret(input.userToken.trim()),
        status: PriceLabsIntegrationStatus.PENDING_SETUP,
        lastError: null,
      },
      update: {
        configuredById: input.configuredById,
        userTokenEncrypted: encryptTTLockSecret(input.userToken.trim()),
        status: PriceLabsIntegrationStatus.PENDING_SETUP,
        lastError: null,
      },
    });
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export function resolveStoredUserToken(
  encrypted: string | null | undefined,
): string | null {
  if (!encrypted) return null;
  return decryptTTLockSecret(encrypted);
}

export async function updatePriceLabsIntegrationState(input: {
  status?: PriceLabsIntegrationStatus;
  lastError?: string | null;
  lastHealthCheckAt?: Date | null;
  lastListingsSyncAt?: Date | null;
  lastPricesSyncAt?: Date | null;
}) {
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
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function listActivePropertiesForPriceLabs() {
  try {
    return await db.property.findMany({
      where: { status: PropertyStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: {
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
        priceLabs: true,
      },
    });
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function getPropertyForPriceLabs(propertyId: string) {
  try {
    return await db.property.findFirst({
      where: { id: propertyId, status: PropertyStatus.ACTIVE },
      select: {
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
        priceLabs: true,
      },
    });
  } catch (error) {
    throw wrapPriceLabsSchemaError(error);
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
    throw wrapPriceLabsSchemaError(error);
  }
}

export async function markPropertyPriceLabsError(
  propertyId: string,
  message: string,
) {
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
    throw wrapPriceLabsSchemaError(error);
  }
}
