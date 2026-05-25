import { PropertyPriceLabsSyncStatus } from "@prisma/client";
import type {
  PriceLabsDailyPrice,
  PriceLabsOverrideRecord,
  StoredPriceLabsMeta,
} from "@/integrations/pricelabs/types";

const STALE_SYNC_MS = 24 * 60 * 60 * 1000;
const PREVIEW_DAYS = 14;

export type PriceLabsDayPreview = {
  date: string;
  recommended: number | null;
  base: number | null;
  minStay: number | null;
  demandLevel: string | null;
  pricingReason: string | null;
  hasOverride: boolean;
};

export type PriceLabsPropertyInsights = {
  overrideCount: number;
  upcomingOverrides: Array<{
    date: string;
    price: number | null;
    minStay: number | null;
  }>;
  minStayToday: number | null;
  maxMinStayNext14: number | null;
  pricingSource: string | null;
  matchReason: string | null;
  listingPms: string | null;
  listingName: string | null;
  pricingReasonSample: string | null;
  ratePlanHints: string[];
  next14Days: PriceLabsDayPreview[];
  hasDailyPrices: boolean;
  lastPricesSync: string | null;
  lastOverridesSync: string | null;
};

export type PriceLabsOperationalInsights = {
  pricingHealth: "healthy" | "attention" | "critical" | "unknown";
  pricingHealthLabel: string;
  syncIssues: number;
  priceAlerts: number;
  listingsNeedingReview: number;
  activeOverridesTotal: number;
  stayRuleWarnings: number;
  lastSyncStatus: "fresh" | "stale" | "never" | "error";
  lastSyncLabel: string;
  unmappedListings: number;
  propertiesWithErrors: string[];
  reviewPropertyIds: string[];
};

type PropertyRowInput = {
  id: string;
  name: string;
  syncStatus: PropertyPriceLabsSyncStatus;
  listingId: string | null;
  priceDelta: string | null;
  lastError: string | null;
  meta: unknown;
};

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function readMeta(meta: unknown): StoredPriceLabsMeta {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return meta as StoredPriceLabsMeta;
}

function pickDayPrice(day: PriceLabsDailyPrice): {
  recommended: number | null;
  base: number | null;
} {
  const recommended =
    toNumber(day.recommended_price) ?? toNumber(day.price) ?? toNumber(day.user_price);
  const base =
    toNumber(day.uncustomized_price) ??
    toNumber(day.user_price) ??
    toNumber(day.price);
  return { recommended, base };
}

function isFutureOrToday(date: string): boolean {
  return date >= todayIsoDate();
}

function buildOverrideIndex(overrides: PriceLabsOverrideRecord[] | undefined) {
  const map = new Map<string, PriceLabsOverrideRecord>();
  for (const row of overrides ?? []) {
    if (row?.date) map.set(row.date.slice(0, 10), row);
  }
  return map;
}

export function buildPropertyInsights(meta: unknown): PriceLabsPropertyInsights {
  const stored = readMeta(meta);
  const daily = stored.dailyPrices ?? [];
  const overrides = stored.overrides ?? [];
  const overrideIndex = buildOverrideIndex(overrides);
  const today = todayIsoDate();

  const upcomingOverrides = overrides
    .filter((row) => row.date && isFutureOrToday(row.date.slice(0, 10)))
    .slice(0, 8)
    .map((row) => ({
      date: row.date.slice(0, 10),
      price: toNumber(row.price),
      minStay: toNumber(row.min_stay),
    }));

  const next14Days: PriceLabsDayPreview[] = [];
  for (let i = 0; i < PREVIEW_DAYS; i += 1) {
    const date = addDays(today, i);
    const day = daily.find((row) => row.date?.slice(0, 10) === date);
    const override = overrideIndex.get(date);
    const prices = day ? pickDayPrice(day) : { recommended: null, base: null };
    next14Days.push({
      date,
      recommended: prices.recommended,
      base: prices.base,
      minStay: toNumber(day?.min_stay) ?? toNumber(override?.min_stay),
      demandLevel: day?.demand_level ?? null,
      pricingReason: day?.pricing_reason ?? null,
      hasOverride: Boolean(override),
    });
  }

  const minStays = next14Days
    .map((row) => row.minStay)
    .filter((value): value is number => value != null && value > 0);

  const ratePlanHints = [
    ...new Set(
      daily
        .map((row) => row.pricing_reason?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, 4);

  const pricingReasonSample =
    daily.find((row) => row.pricing_reason)?.pricing_reason ?? null;

  return {
    overrideCount: overrides.length,
    upcomingOverrides,
    minStayToday: next14Days[0]?.minStay ?? null,
    maxMinStayNext14: minStays.length > 0 ? Math.max(...minStays) : null,
    pricingSource: stored.mode === "dry-run" ? "Simulación PRAGMA" : "PriceLabs API",
    matchReason: stored.matchReason ?? null,
    listingPms: stored.listing?.pms ?? null,
    listingName: stored.listing?.name ?? null,
    pricingReasonSample,
    ratePlanHints,
    next14Days,
    hasDailyPrices: daily.length > 0,
    lastPricesSync: stored.lastPricesSync ?? null,
    lastOverridesSync: stored.lastOverridesSync ?? null,
  };
}

export function computeWeekendUpliftPct(
  days: PriceLabsDailyPrice[],
): number | null {
  const weekday: number[] = [];
  const weekend: number[] = [];

  for (const day of days) {
    const date = day.date?.slice(0, 10);
    if (!date) continue;
    const price =
      toNumber(day.recommended_price) ??
      toNumber(day.price) ??
      toNumber(day.user_price);
    if (price == null) continue;
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (dow === 0 || dow === 6) weekend.push(price);
    else weekday.push(price);
  }

  if (weekday.length === 0 || weekend.length === 0) return null;
  const weekdayAvg = weekday.reduce((a, b) => a + b, 0) / weekday.length;
  const weekendAvg = weekend.reduce((a, b) => a + b, 0) / weekend.length;
  if (weekdayAvg <= 0) return null;
  return Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100);
}

function classifyPriceAlert(priceDelta: string | null): boolean {
  const delta = priceDelta != null ? Number.parseFloat(priceDelta) : null;
  return delta != null && Number.isFinite(delta) && Math.abs(delta) > 1;
}

function needsReview(property: PropertyRowInput): boolean {
  if (property.lastError) return true;
  if (property.syncStatus !== PropertyPriceLabsSyncStatus.SYNCED) return true;
  if (!property.listingId) return true;
  return classifyPriceAlert(property.priceDelta);
}

export function buildOperationalInsights(input: {
  properties: PropertyRowInput[];
  lastPricesSyncAt: string | null;
  integrationStatus: string;
  lastError: string | null;
}): PriceLabsOperationalInsights {
  const { properties, lastPricesSyncAt, integrationStatus, lastError } = input;

  let syncIssues = 0;
  let priceAlerts = 0;
  let listingsNeedingReview = 0;
  let activeOverridesTotal = 0;
  let stayRuleWarnings = 0;
  let unmappedListings = 0;
  const propertiesWithErrors: string[] = [];
  const reviewPropertyIds: string[] = [];

  for (const property of properties) {
    const insights = buildPropertyInsights(property.meta);

    if (!property.listingId) unmappedListings += 1;
    if (property.lastError) {
      syncIssues += 1;
      propertiesWithErrors.push(property.name);
    } else if (property.syncStatus !== PropertyPriceLabsSyncStatus.SYNCED) {
      syncIssues += 1;
    }

    if (classifyPriceAlert(property.priceDelta)) priceAlerts += 1;
    activeOverridesTotal += insights.overrideCount;

    if (
      insights.maxMinStayNext14 != null &&
      insights.maxMinStayNext14 > 1 &&
      insights.upcomingOverrides.some((row) => (row.minStay ?? 0) > 1)
    ) {
      stayRuleWarnings += 1;
    } else if (insights.maxMinStayNext14 != null && insights.maxMinStayNext14 >= 3) {
      stayRuleWarnings += 1;
    }

    if (needsReview(property)) {
      listingsNeedingReview += 1;
      reviewPropertyIds.push(property.id);
    }
  }

  let lastSyncStatus: PriceLabsOperationalInsights["lastSyncStatus"] = "never";
  let lastSyncLabel = "Sin sincronización de precios";

  if (lastError && integrationStatus === "SYNC_FAILED") {
    lastSyncStatus = "error";
    lastSyncLabel = "Última sync con errores";
  } else if (lastPricesSyncAt) {
    const age = Date.now() - new Date(lastPricesSyncAt).getTime();
    if (age <= STALE_SYNC_MS) {
      lastSyncStatus = "fresh";
      lastSyncLabel = "Precios actualizados recientemente";
    } else {
      lastSyncStatus = "stale";
      lastSyncLabel = "Datos de precios desactualizados";
    }
  }

  let pricingHealth: PriceLabsOperationalInsights["pricingHealth"] = "unknown";
  let pricingHealthLabel = "Sin datos de pricing";

  if (properties.length === 0) {
    pricingHealth = "unknown";
    pricingHealthLabel = "Agrega propiedades activas";
  } else if (syncIssues > 0 || lastSyncStatus === "error") {
    pricingHealth = "critical";
    pricingHealthLabel = "Revisar sync y mapeo de listings";
  } else if (
    priceAlerts > 0 ||
    listingsNeedingReview > 0 ||
    lastSyncStatus === "stale" ||
    unmappedListings > 0
  ) {
    pricingHealth = "attention";
    pricingHealthLabel = "Hay ajustes recomendados en pricing";
  } else if (lastSyncStatus === "fresh") {
    pricingHealth = "healthy";
    pricingHealthLabel = "Pricing sincronizado y estable";
  }

  return {
    pricingHealth,
    pricingHealthLabel,
    syncIssues,
    priceAlerts,
    listingsNeedingReview,
    activeOverridesTotal,
    stayRuleWarnings,
    lastSyncStatus,
    lastSyncLabel,
    unmappedListings,
    propertiesWithErrors: propertiesWithErrors.slice(0, 5),
    reviewPropertyIds: reviewPropertyIds.slice(0, 8),
  };
}
