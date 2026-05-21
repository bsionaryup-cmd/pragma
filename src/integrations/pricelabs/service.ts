import { PriceLabsIntegrationStatus, PropertyPriceLabsSyncStatus } from "@prisma/client";
import {
  assertPriceLabsLiveOrThrow,
  isPriceLabsConfigured,
  PriceLabsConfigError,
  resolvePriceLabsAuth,
} from "@/integrations/pricelabs/auth";
import { pushPriceLabsListings } from "@/integrations/pricelabs/listings";
import {
  extractPriceRecommendations,
  fetchPriceLabsPrices,
} from "@/integrations/pricelabs/pricing";
import { mapPropertiesToPriceLabsListings } from "@/integrations/pricelabs/mapper";
import {
  fetchPriceLabsStatus,
  normalizeStatusHealth,
} from "@/integrations/pricelabs/status";
import type {
  PriceLabsPricesSummary,
  PriceLabsSyncSummary,
} from "@/integrations/pricelabs/types";
import { isPriceLabsLiveApiEnabled } from "@/lib/integrations/pricelabs-config";
import {
  ensurePriceLabsIntegration,
  getPriceLabsIntegration,
  getPropertyForPriceLabs,
  listActivePropertiesForPriceLabs,
  markPropertyPriceLabsError,
  resolveStoredUserToken,
  savePriceLabsUserToken,
  updatePriceLabsIntegrationState,
  upsertPropertyPriceLabsSync,
} from "@/services/integrations/pricelabs/pricelabs-persistence";

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function resolveUserTokenOverride(): Promise<string | null> {
  const row = await getPriceLabsIntegration();
  return resolveStoredUserToken(row?.userTokenEncrypted);
}

export type PriceLabsConnectionCheck = {
  ok: boolean;
  message: string;
  healthy?: boolean;
  liveApiEnabled: boolean;
  configured: boolean;
};

export type PriceLabsOverviewDto = {
  integration: {
    status: PriceLabsIntegrationStatus;
    lastError: string | null;
    lastHealthCheckAt: string | null;
    lastListingsSyncAt: string | null;
    lastPricesSyncAt: string | null;
    hasStoredUserToken: boolean;
  };
  config: {
    liveApiEnabled: boolean;
    configured: boolean;
  };
  properties: Array<{
    id: string;
    name: string;
    city: string;
    baseRate: string | null;
    syncStatus: PropertyPriceLabsSyncStatus;
    listingId: string | null;
    recommendedRate: string | null;
    priceDelta: string | null;
    weekendUpliftPct: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
  }>;
  metrics: {
    propertyCount: number;
    syncedCount: number;
    healthLabel: string;
    statusLabel: string;
  };
  canManage: boolean;
};

const statusLabels: Record<PriceLabsIntegrationStatus, string> = {
  NOT_CONNECTED: "No conectado",
  PENDING_SETUP: "Configuración pendiente",
  CONNECTED: "Conectado",
  SYNC_ERROR: "Error de sincronización",
  DEGRADED: "Degradado",
};

export async function connectPriceLabs(input: {
  configuredById: string;
  userToken?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!isPriceLabsConfigured()) {
    return {
      ok: false,
      message:
        "Configura PRICELABS_TOKEN y PRICELABS_USER_TOKEN en el entorno del servidor",
    };
  }

  if (input.userToken?.trim()) {
    await savePriceLabsUserToken({
      configuredById: input.configuredById,
      userToken: input.userToken,
    });
  } else {
    await ensurePriceLabsIntegration();
  }

  await updatePriceLabsIntegrationState({
    status: isPriceLabsLiveApiEnabled()
      ? PriceLabsIntegrationStatus.PENDING_SETUP
      : PriceLabsIntegrationStatus.CONNECTED,
    lastError: null,
  });

  return {
    ok: true,
    message: "PriceLabs marcado como conectado (credenciales en servidor)",
  };
}

export async function checkConnection(): Promise<PriceLabsConnectionCheck> {
  const liveApiEnabled = isPriceLabsLiveApiEnabled();
  const configured = isPriceLabsConfigured();

  if (!configured) {
    return {
      ok: false,
      message: "Faltan variables PRICELABS_TOKEN o PRICELABS_USER_TOKEN",
      liveApiEnabled,
      configured,
    };
  }

  if (!liveApiEnabled) {
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.PENDING_SETUP,
      lastHealthCheckAt: new Date(),
      lastError: null,
    });
    return {
      ok: true,
      message:
        "Credenciales detectadas (modo preparación — PRICELABS_API_ENABLED≠true)",
      healthy: true,
      liveApiEnabled,
      configured,
    };
  }

  try {
    assertPriceLabsLiveOrThrow();
    const userTokenOverride = await resolveUserTokenOverride();
    const result = await fetchPriceLabsStatus({ userTokenOverride });

    if (!result.ok) {
      await updatePriceLabsIntegrationState({
        status: PriceLabsIntegrationStatus.SYNC_ERROR,
        lastHealthCheckAt: new Date(),
        lastError: result.message,
      });
      return {
        ok: false,
        message: result.message,
        liveApiEnabled,
        configured,
      };
    }

    const health = normalizeStatusHealth(result.data);
    await updatePriceLabsIntegrationState({
      status: health.healthy
        ? PriceLabsIntegrationStatus.CONNECTED
        : PriceLabsIntegrationStatus.DEGRADED,
      lastHealthCheckAt: new Date(),
      lastError: health.healthy ? null : result.data.message ?? "Estado degradado",
    });

    return {
      ok: health.healthy,
      message: health.healthy
        ? "Conexión PriceLabs verificada"
        : (result.data.message ?? "Integración degradada"),
      healthy: health.healthy,
      liveApiEnabled,
      configured,
    };
  } catch (error) {
    const message =
      error instanceof PriceLabsConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error al verificar PriceLabs";
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastHealthCheckAt: new Date(),
      lastError: message,
    });
    return { ok: false, message, liveApiEnabled, configured };
  }
}

export async function syncListings(): Promise<
  PriceLabsSyncSummary & { ok: boolean; message: string }
> {
  const properties = await listActivePropertiesForPriceLabs();
  const empty: PriceLabsSyncSummary = {
    synced: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  if (properties.length === 0) {
    return { ok: true, message: "No hay propiedades activas", ...empty };
  }

  if (!isPriceLabsLiveApiEnabled()) {
    for (const property of properties) {
      await upsertPropertyPriceLabsSync({
        propertyId: property.id,
        listingId: property.id,
        syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
        baseRateAtSync: property.baseRate
          ? Number.parseFloat(property.baseRate.toString())
          : null,
        meta: { mode: "dry-run" },
      });
    }
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.PENDING_SETUP,
      lastListingsSyncAt: new Date(),
      lastError: null,
    });
    return {
      ok: true,
      message: `Listings preparados en modo dry-run (${properties.length})`,
      synced: properties.length,
      failed: 0,
      skipped: 0,
      results: properties.map((p) => ({
        propertyId: p.id,
        listingId: p.id,
        ok: true,
      })),
    };
  }

  try {
    assertPriceLabsLiveOrThrow();
    resolvePriceLabsAuth({ userTokenOverride: await resolveUserTokenOverride() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configuración inválida";
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastError: message,
    });
    return { ok: false, message, ...empty };
  }

  const listings = mapPropertiesToPriceLabsListings(properties);
  const userTokenOverride = await resolveUserTokenOverride();
  const api = await pushPriceLabsListings({ listings, userTokenOverride });

  if (!api.ok) {
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastListingsSyncAt: new Date(),
      lastError: api.message,
    });
    return { ok: false, message: api.message, ...empty };
  }

  const summary: PriceLabsSyncSummary = {
    synced: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  const apiListings = api.data.listings ?? [];

  for (const property of properties) {
    const listingId = property.id;
    const apiRow = apiListings.find((r) => r.listing_id === listingId);
    const rowFailed =
      apiRow?.status &&
      !["ok", "success", "synced", "created", "updated"].includes(
        apiRow.status.toLowerCase(),
      );

    if (rowFailed) {
      summary.failed += 1;
      const msg = apiRow?.message ?? "Error al sincronizar listing";
      await markPropertyPriceLabsError(property.id, msg);
      summary.results.push({
        propertyId: property.id,
        listingId,
        ok: false,
        message: msg,
      });
      continue;
    }

    summary.synced += 1;
    await upsertPropertyPriceLabsSync({
      propertyId: property.id,
      listingId,
      syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
      baseRateAtSync: property.baseRate
        ? Number.parseFloat(property.baseRate.toString())
        : null,
      lastError: null,
      meta: { apiStatus: apiRow?.status ?? "synced" },
    });
    summary.results.push({ propertyId: property.id, listingId, ok: true });
  }

  await updatePriceLabsIntegrationState({
    status:
      summary.failed > 0
        ? PriceLabsIntegrationStatus.SYNC_ERROR
        : PriceLabsIntegrationStatus.CONNECTED,
    lastListingsSyncAt: new Date(),
    lastError:
      summary.failed > 0
        ? `${summary.failed} propiedad(es) con error en listings`
        : null,
  });

  return {
    ok: summary.failed === 0,
    message:
      summary.failed === 0
        ? `Listings sincronizados (${summary.synced})`
        : `Sync parcial: ${summary.synced} ok, ${summary.failed} error`,
    ...summary,
  };
}

export async function syncSingleListing(
  propertyId: string,
): Promise<{ ok: boolean; message: string; listingId?: string }> {
  const property = await getPropertyForPriceLabs(propertyId);
  if (!property) {
    return { ok: false, message: "Propiedad no encontrada o inactiva" };
  }

  if (!isPriceLabsLiveApiEnabled()) {
    await upsertPropertyPriceLabsSync({
      propertyId: property.id,
      listingId: property.id,
      syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
      baseRateAtSync: property.baseRate
        ? Number.parseFloat(property.baseRate.toString())
        : null,
      meta: { mode: "dry-run" },
    });
    return {
      ok: true,
      message: "Listing preparado (dry-run)",
      listingId: property.id,
    };
  }

  try {
    assertPriceLabsLiveOrThrow();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configuración inválida";
    await markPropertyPriceLabsError(propertyId, message);
    return { ok: false, message };
  }

  const listings = mapPropertiesToPriceLabsListings([property]);
  const userTokenOverride = await resolveUserTokenOverride();
  const api = await pushPriceLabsListings({ listings, userTokenOverride });

  if (!api.ok) {
    await markPropertyPriceLabsError(propertyId, api.message);
    return { ok: false, message: api.message };
  }

  await upsertPropertyPriceLabsSync({
    propertyId: property.id,
    listingId: property.id,
    syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
    baseRateAtSync: property.baseRate
      ? Number.parseFloat(property.baseRate.toString())
      : null,
    lastError: null,
  });

  return {
    ok: true,
    message: "Listing sincronizado",
    listingId: property.id,
  };
}

export async function fetchDynamicPrices(): Promise<
  PriceLabsPricesSummary & { ok: boolean; message: string }
> {
  const properties = await listActivePropertiesForPriceLabs();
  const listingIds = properties
    .map((p) => p.priceLabs?.listingId ?? p.id)
    .filter(Boolean) as string[];

  const empty: PriceLabsPricesSummary = {
    updated: 0,
    failed: 0,
    results: [],
  };

  if (listingIds.length === 0) {
    return {
      ok: false,
      message: "No hay listings para consultar precios",
      ...empty,
    };
  }

  if (!isPriceLabsLiveApiEnabled()) {
    const today = new Date().toISOString().slice(0, 10);
    for (const property of properties) {
      const base = property.baseRate
        ? Number.parseFloat(property.baseRate.toString())
        : null;
      const recommended = base != null ? Math.round(base * 1.08) : null;
      const delta =
        base != null && recommended != null ? recommended - base : null;
      await upsertPropertyPriceLabsSync({
        propertyId: property.id,
        listingId: property.id,
        recommendedRate: recommended,
        baseRateAtSync: base,
        priceDelta: delta,
        weekendUpliftPct: 0.12,
        syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
        meta: { mode: "dry-run", asOf: today },
      });
      empty.results.push({
        propertyId: property.id,
        listingId: property.id,
        ok: true,
        recommendedRate: recommended,
        priceDelta: delta,
        weekendUpliftPct: 0.12,
      });
      empty.updated += 1;
    }
    await updatePriceLabsIntegrationState({
      lastPricesSyncAt: new Date(),
      lastError: null,
    });
    return {
      ok: true,
      message: `Precios simulados (dry-run) para ${empty.updated} propiedades`,
      ...empty,
    };
  }

  try {
    assertPriceLabsLiveOrThrow();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configuración inválida";
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastError: message,
    });
    return { ok: false, message, ...empty };
  }

  const userTokenOverride = await resolveUserTokenOverride();
  const api = await fetchPriceLabsPrices({
    listingIds,
    userTokenOverride,
  });

  if (!api.ok) {
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastPricesSyncAt: new Date(),
      lastError: api.message,
    });
    return { ok: false, message: api.message, ...empty };
  }

  const recommendations = extractPriceRecommendations(api.data);
  const byListing = new Map(
    recommendations.map((r) => [r.listing_id, r] as const),
  );

  for (const property of properties) {
    const listingId = property.priceLabs?.listingId ?? property.id;
    const rec = byListing.get(listingId);
    if (!rec) {
      empty.failed += 1;
      const msg = "Sin recomendación de precio para este listing";
      await markPropertyPriceLabsError(property.id, msg);
      empty.results.push({
        propertyId: property.id,
        listingId,
        ok: false,
        recommendedRate: null,
        priceDelta: null,
        weekendUpliftPct: null,
        message: msg,
      });
      continue;
    }

    const recommended = parseOptionalNumber(rec.recommended_price);
    const base =
      parseOptionalNumber(rec.base_price) ??
      (property.baseRate
        ? Number.parseFloat(property.baseRate.toString())
        : null);
    const delta =
      parseOptionalNumber(rec.price_delta) ??
      (recommended != null && base != null ? recommended - base : null);
    const weekendUplift = parseOptionalNumber(rec.weekend_uplift_pct);

    await upsertPropertyPriceLabsSync({
      propertyId: property.id,
      listingId,
      recommendedRate: recommended,
      baseRateAtSync: base,
      priceDelta: delta,
      weekendUpliftPct: weekendUplift,
      syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
      lastError: null,
      meta: { raw: rec },
    });

    empty.updated += 1;
    empty.results.push({
      propertyId: property.id,
      listingId,
      ok: true,
      recommendedRate: recommended,
      priceDelta: delta,
      weekendUpliftPct: weekendUplift,
    });
  }

  await updatePriceLabsIntegrationState({
    status:
      empty.failed > 0
        ? PriceLabsIntegrationStatus.DEGRADED
        : PriceLabsIntegrationStatus.CONNECTED,
    lastPricesSyncAt: new Date(),
    lastError:
      empty.failed > 0
        ? `${empty.failed} propiedad(es) sin precio recomendado`
        : null,
  });

  return {
    ok: empty.failed === 0,
    message:
      empty.failed === 0
        ? `Precios actualizados (${empty.updated})`
        : `Sync parcial de precios: ${empty.updated} ok, ${empty.failed} error`,
    ...empty,
  };
}

export async function getPriceLabsOverview(
  canManage: boolean,
): Promise<PriceLabsOverviewDto> {
  const row = await ensurePriceLabsIntegration();
  const properties = await listActivePropertiesForPriceLabs();

  const syncedCount = properties.filter(
    (p) => p.priceLabs?.syncStatus === PropertyPriceLabsSyncStatus.SYNCED,
  ).length;

  const healthLabel =
    row.status === PriceLabsIntegrationStatus.CONNECTED
      ? "Saludable"
      : row.status === PriceLabsIntegrationStatus.DEGRADED
        ? "Degradado"
        : statusLabels[row.status];

  return {
    integration: {
      status: row.status,
      lastError: row.lastError,
      lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
      lastListingsSyncAt: row.lastListingsSyncAt?.toISOString() ?? null,
      lastPricesSyncAt: row.lastPricesSyncAt?.toISOString() ?? null,
      hasStoredUserToken: Boolean(row.userTokenEncrypted),
    },
    config: {
      liveApiEnabled: isPriceLabsLiveApiEnabled(),
      configured: isPriceLabsConfigured(),
    },
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      baseRate: p.baseRate?.toString() ?? null,
      syncStatus:
        p.priceLabs?.syncStatus ?? PropertyPriceLabsSyncStatus.PENDING,
      listingId: p.priceLabs?.listingId ?? null,
      recommendedRate: p.priceLabs?.recommendedRate?.toString() ?? null,
      priceDelta: p.priceLabs?.priceDelta?.toString() ?? null,
      weekendUpliftPct: p.priceLabs?.weekendUpliftPct?.toString() ?? null,
      lastSyncedAt: p.priceLabs?.lastSyncedAt?.toISOString() ?? null,
      lastError: p.priceLabs?.lastError ?? null,
    })),
    metrics: {
      propertyCount: properties.length,
      syncedCount,
      healthLabel,
      statusLabel: statusLabels[row.status],
    },
    canManage,
  };
}
