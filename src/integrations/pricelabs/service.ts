import { PriceLabsIntegrationStatus, PropertyPriceLabsSyncStatus } from "@prisma/client";
import { assertPriceLabsLiveOrThrow, PriceLabsConfigError } from "@/integrations/pricelabs/auth";
import { fetchPriceLabsListings } from "@/integrations/pricelabs/listings";
import { fetchPriceLabsNeighborhoodData } from "@/integrations/pricelabs/neighborhood";
import { fetchPriceLabsOverrides } from "@/integrations/pricelabs/overrides";
import {
  buildPricingDateRange,
  matchListingsToProperties,
} from "@/integrations/pricelabs/mapper";
import {
  fetchPriceLabsListingPrices,
  isSkippedListingPriceRow,
} from "@/integrations/pricelabs/pricing";
import { checkPriceLabsReachability } from "@/integrations/pricelabs/status";
import type {
  PriceLabsDailyPrice,
  PriceLabsPricesSummary,
  PriceLabsSyncSummary,
  StoredPriceLabsMeta,
} from "@/integrations/pricelabs/types";
import { isPriceLabsLiveApiEnabled } from "@/lib/integrations/pricelabs-config";
import {
  getPriceLabsCredentialSnapshot,
  isPriceLabsConfiguredAsync,
} from "@/services/integrations/pricelabs/pricelabs-credentials";
import {
  appendPriceLabsSyncLog,
  listPriceLabsSyncLogs,
} from "@/services/integrations/pricelabs/pricelabs-audit";
import { getPriceLabsSchemaSetupHint } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import type { PriceLabsCredentialStatus } from "@/services/integrations/pricelabs/pricelabs-credentials";
import {
  getPropertyForPriceLabs,
  getPriceLabsIntegrationSafe,
  listActivePropertiesForPriceLabs,
  markPropertyPriceLabsError,
  markPriceLabsIntegrationReady,
  resolvePriceLabsTenantScope,
  revokePriceLabsApiKey,
  saveNeighborhoodSnapshot,
  savePriceLabsApiKeyEncrypted,
  updatePriceLabsIntegrationState,
  upsertPropertyPriceLabsSync,
} from "@/services/integrations/pricelabs/pricelabs-persistence";
import { isPriceLabsSyncInProgress } from "@/services/integrations/pricelabs/pricelabs-sync-lock";
import { isPriceLabsSchemaReady } from "@/services/integrations/pricelabs/pricelabs-schema";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  assertPropertyInScope,
  integrationVisibleToOrganization,
} from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { propertyWhere } from "@/lib/platform/tenant-data-scope";

function readListingInsights(meta: unknown): {
  minRate: string | null;
  maxRate: string | null;
  listingBase: string | null;
  revenue: string | null;
  occupancy: string | null;
} {
  const stored = meta as StoredPriceLabsMeta | null;
  const listing = stored?.listing;
  if (!listing) {
    return {
      minRate: null,
      maxRate: null,
      listingBase: null,
      revenue: null,
      occupancy: null,
    };
  }

  const formatAmount = (value: number | undefined) =>
    value != null && Number.isFinite(value) ? String(Math.round(value)) : null;

  const occupancy =
    listing.occupancy != null && Number.isFinite(listing.occupancy)
      ? `${Math.round(listing.occupancy)}%`
      : null;

  return {
    minRate: formatAmount(listing.min),
    maxRate: formatAmount(listing.max),
    listingBase: formatAmount(listing.base),
    revenue: formatAmount(listing.revenue),
    occupancy,
  };
}

function parseOptionalRate(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number.parseFloat(value.replace(/,/g, "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Precio inválido");
  }
  return Math.round(parsed);
}

function pickSummaryFromDays(days: PriceLabsDailyPrice[]) {
  const first = days.find((d) => d.recommended_price != null || d.price != null);
  const recommended =
    first?.recommended_price ?? first?.price ?? null;
  const base = first?.uncustomized_price ?? first?.user_price ?? null;
  const delta =
    recommended != null && base != null ? recommended - base : null;
  return { recommended, base, delta, days };
}

export type PriceLabsConnectionCheck = {
  ok: boolean;
  message: string;
  healthy?: boolean;
  liveApiEnabled: boolean;
  configured: boolean;
  listingCount?: number;
};

export type PriceLabsOverviewDto = {
  integration: {
    status: PriceLabsIntegrationStatus;
    lastError: string | null;
    lastHealthCheckAt: string | null;
    lastListingsSyncAt: string | null;
    lastPricesSyncAt: string | null;
  };
  database: {
    ready: boolean;
    setupRequired: boolean;
    hint: string | null;
  };
  config: {
    liveApiEnabled: boolean;
    configured: boolean;
  };
  credentials: {
    status: import("@/services/integrations/pricelabs/pricelabs-credentials").PriceLabsCredentialStatus;
    keyHint: string | null;
    hasStoredKey: boolean;
    hasEnvKey: boolean;
    decryptFailed: boolean;
  };
  revenue: {
    underpricedCount: number;
    overpricedCount: number;
    neutralCount: number;
    avgDelta: string | null;
  };
  auditLog: Array<{
    id: string;
    action: string;
    result: string;
    message: string | null;
    source: string;
    createdAt: string;
  }>;
  syncing: boolean;
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
    minRate: string | null;
    maxRate: string | null;
    listingBase: string | null;
    revenue: string | null;
    occupancy: string | null;
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

export async function savePriceLabsApiKeyFromPanel(input: {
  configuredById: string;
  apiKey: string;
}): Promise<{ ok: boolean; message: string }> {
  const saved = await savePriceLabsApiKeyEncrypted({
    configuredById: input.configuredById,
    apiKey: input.apiKey,
  });
  if (!saved.ok) return saved;

  await updatePriceLabsIntegrationState({
    status: PriceLabsIntegrationStatus.PENDING_SETUP,
    lastError: null,
  });
  await appendPriceLabsSyncLog({
    action: "save_api_key",
    result: "success",
    message: "API key almacenada (cifrada)",
    source: "manual",
  });

  if (!isPriceLabsLiveApiEnabled()) {
    return {
      ok: true,
      message:
        "API key guardada. Modo simulación activo (PRICELABS_API_ENABLED=false).",
    };
  }

  const health = await checkConnection();
  if (!health.ok) {
    return {
      ok: false,
      message: `API key guardada, pero PriceLabs rechazó la conexión: ${health.message}`,
    };
  }

  const listingHint =
    health.listingCount != null
      ? `${health.listingCount} listing(s) detectado(s). `
      : "";

  return {
    ok: true,
    message: `${listingHint}Conexión verificada. Usa «Pipeline completo» para sincronizar precios.`,
  };
}

export async function revokePriceLabsApiKeyFromPanel(): Promise<{
  ok: boolean;
  message: string;
}> {
  const result = await revokePriceLabsApiKey();
  if (result.ok) {
    await appendPriceLabsSyncLog({
      action: "revoke_api_key",
      result: "success",
      message: result.message,
      source: "manual",
    });
  }
  return result;
}

export async function syncPriceLabsOverrides(): Promise<{
  ok: boolean;
  message: string;
  updated: number;
  failed: number;
}> {
  if (!(await isPriceLabsConfiguredAsync())) {
    return {
      ok: false,
      message: "Configura la API key de PriceLabs",
      updated: 0,
      failed: 0,
    };
  }

  try {
    assertPriceLabsLiveOrThrow();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof PriceLabsConfigError ? e.message : "API deshabilitada",
      updated: 0,
      failed: 0,
    };
  }

  const scope = await resolvePriceLabsTenantScope();
  const properties = await listActivePropertiesForPriceLabs(scope);
  let updated = 0;
  let failed = 0;

  for (const property of properties) {
    const listingId = property.priceLabs?.listingId;
    if (!listingId) continue;

    const ov = await fetchPriceLabsOverrides(listingId);
    if (!ov.ok) {
      failed += 1;
      continue;
    }

    const existingMeta =
      (property.priceLabs?.meta as StoredPriceLabsMeta | null) ?? {};
    await upsertPropertyPriceLabsSync({
      propertyId: property.id,
      listingId,
      syncStatus: property.priceLabs?.syncStatus ?? PropertyPriceLabsSyncStatus.SYNCED,
      meta: {
        ...existingMeta,
        overrides: ov.data,
        lastOverridesSync: new Date().toISOString(),
      },
    });
    updated += 1;
  }

  await appendPriceLabsSyncLog({
    action: "sync_overrides",
    result: failed === 0 ? "success" : "failure",
    message: `${updated} ok, ${failed} error`,
    source: "manual",
  });

  return {
    ok: failed === 0,
    message:
      failed === 0
        ? `Overrides importados (${updated})`
        : `Sync parcial overrides: ${updated} ok, ${failed} error`,
    updated,
    failed,
  };
}

export async function markPriceLabsSetupFromPanel(input: {
  configuredById: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!(await isPriceLabsConfiguredAsync())) {
    return {
      ok: false,
      message: "Guarda la API key de PriceLabs en el panel de integración",
    };
  }
  const result = await markPriceLabsIntegrationReady(input);
  if (result.ok) {
    await updatePriceLabsIntegrationState({
      status: isPriceLabsLiveApiEnabled()
        ? PriceLabsIntegrationStatus.PENDING_SETUP
        : PriceLabsIntegrationStatus.CONNECTED,
      lastError: null,
    });
  }
  return result;
}

export async function checkConnection(): Promise<PriceLabsConnectionCheck> {
  const liveApiEnabled = isPriceLabsLiveApiEnabled();
  const configured = await isPriceLabsConfiguredAsync();

  if (!configured) {
    return {
      ok: false,
      message: "Pega tu API key de PriceLabs en el panel de integración",
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
      message: "API key detectada (modo simulación — PRICELABS_API_ENABLED=false)",
      healthy: true,
      liveApiEnabled,
      configured,
    };
  }

  try {
    assertPriceLabsLiveOrThrow();
    const result = await checkPriceLabsReachability();
    if (!result.ok) {
      await updatePriceLabsIntegrationState({
        status: PriceLabsIntegrationStatus.SYNC_ERROR,
        lastHealthCheckAt: new Date(),
        lastError: result.message,
      });
      await appendPriceLabsSyncLog({
        action: "test_connection",
        result: "failure",
        message: result.message,
        source: "manual",
      });
      return {
        ok: false,
        message: result.message,
        liveApiEnabled,
        configured,
      };
    }

    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.CONNECTED,
      lastHealthCheckAt: new Date(),
      lastError: null,
    });
    await appendPriceLabsSyncLog({
      action: "test_connection",
      result: "success",
      message: `${result.data.listingCount} listings en PriceLabs`,
      source: "manual",
    });

    return {
      ok: true,
      message: `Conexión verificada (${result.data.listingCount} listings)`,
      healthy: result.data.healthy,
      listingCount: result.data.listingCount,
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
  const empty: PriceLabsSyncSummary = {
    synced: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  const scope = await resolvePriceLabsTenantScope();
  const properties = await listActivePropertiesForPriceLabs(scope);
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
      message: `Listings simulados (dry-run) para ${properties.length} propiedades`,
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Configuración inválida";
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastError: message,
    });
    return { ok: false, message, ...empty };
  }

  const api = await fetchPriceLabsListings();
  if (!api.ok) {
    await updatePriceLabsIntegrationState({
      status: PriceLabsIntegrationStatus.SYNC_ERROR,
      lastListingsSyncAt: new Date(),
      lastError: api.message,
    });
    return { ok: false, message: api.message, ...empty };
  }

  const existingMap = new Map(
    properties
      .filter((p) => p.priceLabs?.listingId)
      .map((p) => [p.id, p.priceLabs!.listingId!] as const),
  );

  const matches = matchListingsToProperties({
    listings: api.data,
    properties,
    existingListingByPropertyId: existingMap,
  });

  const summary: PriceLabsSyncSummary = {
    synced: 0,
    failed: 0,
    skipped: properties.length - matches.length,
    results: [],
  };

  const matchedIds = new Set(matches.map((m) => m.propertyId));

  for (const match of matches) {
    const property = properties.find((p) => p.id === match.propertyId);
    const base =
      match.listing.base ??
      match.listing.recommended_base_price ??
      (property?.baseRate
        ? Number.parseFloat(property.baseRate.toString())
        : null);

    await upsertPropertyPriceLabsSync({
      propertyId: match.propertyId,
      listingId: match.listingId,
      syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
      recommendedRate: match.listing.recommended_base_price ?? null,
      baseRateAtSync: base,
      priceDelta:
        match.listing.recommended_base_price != null && base != null
          ? match.listing.recommended_base_price - base
          : null,
      lastError: null,
      meta: {
        listing: match.listing,
        matchReason: match.matchReason,
        lastListingRefresh: new Date().toISOString(),
      } satisfies StoredPriceLabsMeta,
    });

    summary.synced += 1;
    summary.results.push({
      propertyId: match.propertyId,
      listingId: match.listingId,
      ok: true,
    });
  }

  for (const property of properties) {
    if (matchedIds.has(property.id)) continue;
    summary.failed += 1;
    const msg = "Sin listing coincidente en PriceLabs";
    await markPropertyPriceLabsError(property.id, msg);
    summary.results.push({
      propertyId: property.id,
      listingId: property.id,
      ok: false,
      message: msg,
    });
  }

  await updatePriceLabsIntegrationState({
    status:
      summary.failed > 0
        ? PriceLabsIntegrationStatus.DEGRADED
        : PriceLabsIntegrationStatus.CONNECTED,
    lastListingsSyncAt: new Date(),
    lastError:
      summary.failed > 0
        ? `${summary.failed} propiedad(es) sin match en PriceLabs`
        : null,
  });

  return {
    ok: summary.failed === 0,
    message:
      summary.failed === 0
        ? `Listings vinculados (${summary.synced})`
        : `Sync parcial: ${summary.synced} ok, ${summary.failed} sin match`,
    ...summary,
  };
}

export async function syncSingleListing(
  propertyId: string,
): Promise<{ ok: boolean; message: string; listingId?: string }> {
  const scope = await requireTenantDataScope();
  const property = await getPropertyForPriceLabs(propertyId, scope);
  if (!property) {
    return { ok: false, message: "Propiedad no encontrada o inactiva" };
  }

  const batch = await syncListings();
  const row = batch.results.find((r) => r.propertyId === propertyId);
  if (!row?.ok) {
    return { ok: false, message: row?.message ?? batch.message };
  }
  return {
    ok: true,
    message: "Listing sincronizado",
    listingId: row.listingId,
  };
}

export async function fetchDynamicPrices(): Promise<
  PriceLabsPricesSummary & { ok: boolean; message: string }
> {
  const scope = await resolvePriceLabsTenantScope();
  const properties = await listActivePropertiesForPriceLabs(scope);
  const empty: PriceLabsPricesSummary = {
    updated: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  const withListing = properties.filter(
    (p) => p.priceLabs?.listingId ?? p.id,
  );
  if (withListing.length === 0) {
    return { ok: false, message: "No hay listings vinculados", ...empty };
  }

  if (!isPriceLabsLiveApiEnabled()) {
    const today = new Date().toISOString().slice(0, 10);
    for (const property of withListing) {
      const base = property.baseRate
        ? Number.parseFloat(property.baseRate.toString())
        : null;
      const recommended = base != null ? Math.round(base * 1.08) : null;
      const delta =
        base != null && recommended != null ? recommended - base : null;
      await upsertPropertyPriceLabsSync({
        propertyId: property.id,
        listingId: property.priceLabs?.listingId ?? property.id,
        recommendedRate: recommended,
        baseRateAtSync: base,
        priceDelta: delta,
        syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
        meta: { mode: "dry-run", asOf: today },
      });
      empty.updated += 1;
      empty.results.push({
        propertyId: property.id,
        listingId: property.id,
        ok: true,
        recommendedRate: recommended,
        priceDelta: delta,
        weekendUpliftPct: null,
      });
    }
    await updatePriceLabsIntegrationState({ lastPricesSyncAt: new Date() });
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

  const { dateFrom, dateTo } = buildPricingDateRange(90);
  const listingIds = withListing.map(
    (p) => p.priceLabs?.listingId ?? p.id,
  );

  const BATCH = 10;
  for (let i = 0; i < listingIds.length; i += BATCH) {
    const chunk = listingIds.slice(i, i + BATCH);
    const api = await fetchPriceLabsListingPrices({
      listings: chunk.map((id) => ({ id, dateFrom, dateTo })),
    });

    if (!api.ok) {
      await updatePriceLabsIntegrationState({
        status: PriceLabsIntegrationStatus.SYNC_ERROR,
        lastPricesSyncAt: new Date(),
        lastError: api.message,
      });
      return { ok: false, message: api.message, ...empty };
    }

    for (const property of withListing) {
      const listingId = property.priceLabs?.listingId ?? property.id;
      if (!chunk.includes(listingId)) continue;

      const row = api.data.find(
        (r) => (r.listing_id ?? r.id) === listingId,
      );
      if (!row) {
        empty.failed += 1;
        continue;
      }

      if (isSkippedListingPriceRow(row)) {
        empty.skipped += 1;
        empty.results.push({
          propertyId: property.id,
          listingId,
          ok: true,
          recommendedRate: null,
          priceDelta: null,
          weekendUpliftPct: null,
          message: row.error ?? "Listing sin datos",
        });
        continue;
      }

      const days = row.data ?? row.prices ?? row.days ?? [];
      const summary = pickSummaryFromDays(days);

      let overrides: StoredPriceLabsMeta["overrides"];
      const ov = await fetchPriceLabsOverrides(listingId);
      if (ov.ok) overrides = ov.data;

      const priorMeta =
        property.priceLabs?.meta &&
        typeof property.priceLabs.meta === "object" &&
        !Array.isArray(property.priceLabs.meta)
          ? (property.priceLabs.meta as StoredPriceLabsMeta)
          : {};

      await upsertPropertyPriceLabsSync({
        propertyId: property.id,
        listingId,
        recommendedRate: summary.recommended,
        baseRateAtSync:
          summary.base ??
          (property.baseRate
            ? Number.parseFloat(property.baseRate.toString())
            : null),
        priceDelta: summary.delta,
        syncStatus: PropertyPriceLabsSyncStatus.SYNCED,
        lastError: null,
        meta: {
          ...priorMeta,
          dailyPrices: summary.days,
          overrides,
          lastPricesSync: new Date().toISOString(),
        },
      });

      empty.updated += 1;
      empty.results.push({
        propertyId: property.id,
        listingId,
        ok: true,
        recommendedRate: summary.recommended,
        priceDelta: summary.delta,
        weekendUpliftPct: null,
      });
    }
  }

  const neighborhood = await fetchPriceLabsNeighborhoodData();
  if (neighborhood.ok) {
    await saveNeighborhoodSnapshot(
      neighborhood.data as Record<string, unknown>,
    );
  }

  await updatePriceLabsIntegrationState({
    status:
      empty.failed > 0
        ? PriceLabsIntegrationStatus.DEGRADED
        : PriceLabsIntegrationStatus.CONNECTED,
    lastPricesSyncAt: new Date(),
    lastError:
      empty.failed > 0
        ? `${empty.failed} propiedad(es) sin precios`
        : null,
  });

  return {
    ok: empty.failed === 0,
    message:
      empty.failed === 0
        ? `Precios importados (${empty.updated}, ${empty.skipped} omitidos)`
        : `Sync parcial: ${empty.updated} ok, ${empty.failed} error`,
    ...empty,
  };
}

export async function savePropertyPriceBoundsFromPanel(input: {
  propertyId: string;
  baseRate?: string;
  minRate?: string;
  maxRate?: string;
}): Promise<{ ok: boolean; message: string }> {
  const scope = await requireTenantDataScope();
  await assertPropertyInScope(scope, input.propertyId);

  const property = await getPropertyForPriceLabs(input.propertyId, scope);
  if (!property) {
    return { ok: false, message: "Propiedad no encontrada" };
  }

  const baseRate = parseOptionalRate(input.baseRate);
  const minRate = parseOptionalRate(input.minRate);
  const maxRate = parseOptionalRate(input.maxRate);

  if (baseRate != null && minRate != null && baseRate < minRate) {
    return { ok: false, message: "La tarifa base no puede ser menor al mínimo" };
  }
  if (baseRate != null && maxRate != null && baseRate > maxRate) {
    return { ok: false, message: "La tarifa base no puede ser mayor al máximo" };
  }
  if (minRate != null && maxRate != null && minRate > maxRate) {
    return { ok: false, message: "El mínimo no puede ser mayor al máximo" };
  }

  if (baseRate != null) {
    await db.property.updateMany({
      where: { id: input.propertyId, ...propertyWhere(scope) },
      data: { baseRate },
    });
  }

  const existingMeta = (property.priceLabs?.meta as StoredPriceLabsMeta | null) ?? {};
  const listingId = property.priceLabs?.listingId ?? input.propertyId;
  const listing = {
    ...(existingMeta.listing ?? { id: listingId }),
    id: listingId,
  };

  if (minRate != null) listing.min = minRate;
  if (maxRate != null) listing.max = maxRate;
  if (baseRate != null) listing.base = baseRate;

  await upsertPropertyPriceLabsSync({
    propertyId: input.propertyId,
    listingId,
    recommendedRate: property.priceLabs?.recommendedRate
      ? Number.parseFloat(property.priceLabs.recommendedRate.toString())
      : null,
    baseRateAtSync: baseRate ?? (property.baseRate
      ? Number.parseFloat(property.baseRate.toString())
      : null),
    priceDelta: property.priceLabs?.priceDelta
      ? Number.parseFloat(property.priceLabs.priceDelta.toString())
      : null,
    weekendUpliftPct: property.priceLabs?.weekendUpliftPct
      ? Number.parseFloat(property.priceLabs.weekendUpliftPct.toString())
      : null,
    syncStatus:
      property.priceLabs?.syncStatus ?? PropertyPriceLabsSyncStatus.PENDING,
    lastError: property.priceLabs?.lastError ?? null,
    meta: {
      ...existingMeta,
      listing,
    },
  });

  return { ok: true, message: "Límites de precio guardados" };
}

export async function getPriceLabsOverview(
  canManage: boolean,
): Promise<PriceLabsOverviewDto> {
  const scope = await requireTenantDataScope();
  const schemaReady = await isPriceLabsSchemaReady();
  const credentials = await getPriceLabsCredentialSnapshot();
  const row = schemaReady ? await getPriceLabsIntegrationSafe() : null;
  const configurator = row?.configuredById
    ? await db.user.findUnique({
        where: { id: row.configuredById },
        select: { organizationId: true },
      })
    : null;
  const integrationAccessible = integrationVisibleToOrganization(
    row?.configuredById,
    configurator?.organizationId,
    scope.organizationId,
  );
  const properties = await listActivePropertiesForPriceLabs(scope);

  const integrationStatus =
    integrationAccessible && row?.status
      ? row.status
      : credentials.configured && integrationAccessible
      ? PriceLabsIntegrationStatus.PENDING_SETUP
      : PriceLabsIntegrationStatus.NOT_CONNECTED;

  const syncedCount = properties.filter(
    (p) => p.priceLabs?.syncStatus === PropertyPriceLabsSyncStatus.SYNCED,
  ).length;

  let underpricedCount = 0;
  let overpricedCount = 0;
  let neutralCount = 0;
  let deltaSum = 0;
  let deltaCount = 0;

  for (const p of properties) {
    const d =
      p.priceLabs?.priceDelta != null
        ? Number.parseFloat(p.priceLabs.priceDelta.toString())
        : null;
    if (d == null || !Number.isFinite(d)) {
      neutralCount += 1;
      continue;
    }
    deltaSum += d;
    deltaCount += 1;
    if (d < -1) underpricedCount += 1;
    else if (d > 1) overpricedCount += 1;
    else neutralCount += 1;
  }

  const healthLabel = !schemaReady
    ? "Setup requerido"
    : !credentials.configured
      ? "En espera de API key"
      : integrationStatus === PriceLabsIntegrationStatus.CONNECTED
        ? "Saludable"
        : integrationStatus === PriceLabsIntegrationStatus.DEGRADED
          ? "Degradado"
          : statusLabels[integrationStatus];

  const statusLabel = !schemaReady
    ? "Setup requerido"
    : !credentials.configured
      ? "En espera de credenciales"
      : statusLabels[integrationStatus];

  const auditRows = await listPriceLabsSyncLogs(15);
  const syncing = await isPriceLabsSyncInProgress();
  const decryptErrorMessage = credentials.decryptFailed
    ? "La API key guardada no se puede descifrar con las claves actuales del servidor. Vuelve a pegarla en el panel o verifica TTLOCK_ENCRYPTION_KEY en Vercel."
    : null;

  return {
    integration: {
      status: integrationStatus,
      lastError: row?.lastError ?? decryptErrorMessage,
      lastHealthCheckAt: row?.lastHealthCheckAt?.toISOString() ?? null,
      lastListingsSyncAt: row?.lastListingsSyncAt?.toISOString() ?? null,
      lastPricesSyncAt: row?.lastPricesSyncAt?.toISOString() ?? null,
    },
    database: {
      ready: schemaReady,
      setupRequired: !schemaReady,
      hint: schemaReady ? null : getPriceLabsSchemaSetupHint(),
    },
    config: {
      liveApiEnabled: isPriceLabsLiveApiEnabled(),
      configured: credentials.configured,
    },
    credentials: {
      status: credentials.status as PriceLabsCredentialStatus,
      keyHint: credentials.keyHint,
      hasStoredKey: credentials.hasStoredKey,
      hasEnvKey: credentials.hasEnvKey,
      decryptFailed: credentials.decryptFailed,
    },
    revenue: {
      underpricedCount,
      overpricedCount,
      neutralCount,
      avgDelta:
        deltaCount > 0 ? String(Math.round(deltaSum / deltaCount)) : null,
    },
    auditLog: auditRows.map((log) => ({
      id: log.id,
      action: log.action,
      result: log.result,
      message: log.message,
      source: log.source,
      createdAt: log.createdAt.toISOString(),
    })),
    syncing,
    properties: properties.map((p) => {
      const insights = readListingInsights(p.priceLabs?.meta ?? null);
      return {
        id: p.id,
        name: p.name,
        city: p.city,
        baseRate: p.baseRate?.toString() ?? insights.listingBase,
        syncStatus:
          p.priceLabs?.syncStatus ?? PropertyPriceLabsSyncStatus.PENDING,
        listingId: p.priceLabs?.listingId ?? null,
        recommendedRate: p.priceLabs?.recommendedRate?.toString() ?? null,
        priceDelta: p.priceLabs?.priceDelta?.toString() ?? null,
        weekendUpliftPct: p.priceLabs?.weekendUpliftPct?.toString() ?? null,
        minRate: insights.minRate,
        maxRate: insights.maxRate,
        listingBase: insights.listingBase,
        revenue: insights.revenue,
        occupancy: insights.occupancy,
        lastSyncedAt: p.priceLabs?.lastSyncedAt?.toISOString() ?? null,
        lastError: p.priceLabs?.lastError ?? null,
      };
    }),
    metrics: {
      propertyCount: properties.length,
      syncedCount,
      healthLabel,
      statusLabel,
    },
    canManage,
  };
}
