/**
 * Validación operativa de negocio — PriceLabs bounds + calendario futuro.
 *
 * Uso:
 *   node scripts/validate-pricelabs-business.mjs
 *   node scripts/validate-pricelabs-business.mjs --keep-change
 */
import { config } from "dotenv";
import { createDecipheriv, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrganizationIntegrationProvider } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const PROPERTY_ID = "cmpm0xani000004jgxfqjnih0";
const LISTING_ID = "1659835181966511536";
const SECRET_PREFIX = "enc:v1:";
const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(/\/$/, "");

const hasFlag = (name) => process.argv.includes(name);

function getEncryptionKey() {
  const source =
    process.env.TTLOCK_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    process.env.DATABASE_URL;
  return createHash("sha256").update(source).digest();
}

function decryptSecret(value) {
  if (!value?.startsWith(SECRET_PREFIX)) return value?.trim() || null;
  const raw = Buffer.from(value.slice(SECRET_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8").trim();
}

async function resolveApiKey(db) {
  const row = await db.organizationIntegration.findUnique({
    where: {
      organizationId_provider: {
        organizationId: ORG_ID,
        provider: OrganizationIntegrationProvider.PRICELABS,
      },
    },
    select: { apiKeyEncrypted: true },
  });
  return decryptSecret(row?.apiKeyEncrypted) || process.env.PRICELABS_API_KEY?.trim() || null;
}

async function pl(apiKey, path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { message: raw.slice(0, 300) };
  }
  return { status: response.status, payload, body };
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pickPrices(row) {
  return row?.data ?? row?.prices ?? row?.days ?? [];
}

function analyzeCalendar(days, minBound) {
  const violations = [];
  const belowMin = [];
  const highMinStay = [];
  const withOverrideSignal = [];

  for (const day of days) {
    const date = day.date?.slice(0, 10);
    const price =
      day.recommended_price ?? day.price ?? day.user_price ?? null;
    const minStay = day.min_stay ?? null;
    const reason = day.pricing_reason ?? day.demand_level ?? null;

    if (price != null && minBound != null && price < minBound) {
      belowMin.push({ date, price, minBound, reason });
    }
    if (minStay != null && minStay >= 5) {
      highMinStay.push({ date, minStay, price });
    }
    if (reason && /override|custom|manual|dso/i.test(String(reason))) {
      withOverrideSignal.push({ date, price, reason });
    }
  }

  const prices = days
    .map((d) => d.recommended_price ?? d.price ?? d.user_price)
    .filter((v) => v != null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  return { belowMin, highMinStay, withOverrideSignal, minPrice, maxPrice, dayCount: days.length };
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function readLocal(propertyId) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    include: { priceLabs: true },
  });
  const meta = property?.priceLabs?.meta ?? {};
  const listing = meta.listing ?? {};
  return {
    baseRate: property?.baseRate?.toString() ?? null,
    min: listing.min ?? null,
    base: listing.base ?? null,
    max: listing.max ?? null,
    syncStatus: property?.priceLabs?.syncStatus ?? null,
    lastError: property?.priceLabs?.lastError ?? null,
  };
}

async function persistLocalLikeApp(propertyId, listingId, { min, base, max }) {
  const row = await db.propertyPriceLabs.findUnique({ where: { propertyId } });
  const meta = row?.meta && typeof row.meta === "object" ? { ...row.meta } : {};
  const listing = { ...(meta.listing ?? { id: listingId }), id: listingId };
  if (min != null) listing.min = min;
  if (base != null) listing.base = base;
  if (max != null) listing.max = max;
  meta.listing = listing;
  meta.lastListingRefresh = new Date().toISOString();
  meta.lastBoundsUpdate = new Date().toISOString();

  if (base != null) {
    await db.property.update({
      where: { id: propertyId },
      data: { baseRate: base },
    });
  }

  await db.propertyPriceLabs.upsert({
    where: { propertyId },
    create: {
      propertyId,
      listingId,
      syncStatus: "SYNCED",
      lastError: null,
      meta,
      lastSyncedAt: new Date(),
      baseRateAtSync: base ?? null,
    },
    update: {
      listingId,
      syncStatus: "SYNCED",
      lastError: null,
      meta,
      lastSyncedAt: new Date(),
      baseRateAtSync: base ?? undefined,
    },
  });
}

async function main() {
  const apiKey = await resolveApiKey(db);
  if (!apiKey) throw new Error("Sin API key PriceLabs");

  const report = {
    testAt: new Date().toISOString(),
    property: "APTO 803 · Loft 2P Vista Premium",
    propertyId: PROPERTY_ID,
    listingId: LISTING_ID,
    steps: [],
    blockers: [],
    priceLabsConfigsThatCanKeepPricesHigh: [],
    verdict: null,
  };

  const beforeLocal = await readLocal(PROPERTY_ID);
  const beforeListing = await pl(apiKey, "/v1/listings");
  const remoteBefore = (beforeListing.payload.listings ?? []).find(
    (l) => String(l.id) === LISTING_ID,
  );
  const originalMin = remoteBefore?.min ?? beforeLocal.min ?? 175300;
  const testMin = originalMin - 5000;

  report.steps.push({
    step: 1,
    action: "Estado inicial",
    localBefore: beforeLocal,
    priceLabsBefore: {
      min: remoteBefore?.min,
      base: remoteBefore?.base,
      max: remoteBefore?.max,
      recommended_base_price: remoteBefore?.recommended_base_price,
      push_enabled: remoteBefore?.push_enabled,
      last_refreshed_at: remoteBefore?.last_refreshed_at,
    },
  });

  const post = await pl(apiKey, "/v1/listings", {
    method: "POST",
    body: {
      listings: [{ id: LISTING_ID, pms: "airbnb", min: testMin }],
    },
  });
  report.steps.push({
    step: 2,
    action: `Bajar mínimo ${originalMin} → ${testMin}`,
    httpStatus: post.status,
    request: { listings: [{ id: LISTING_ID, pms: "airbnb", min: testMin }] },
    response: post.payload,
    pass: post.status === 200,
  });

  const verifyListing = await pl(apiKey, "/v1/listings");
  const remoteAfter = (verifyListing.payload.listings ?? []).find(
    (l) => String(l.id) === LISTING_ID,
  );
  report.steps.push({
    step: 3,
    action: "PriceLabs refleja nuevo mínimo (API = interfaz PL)",
    priceLabsAfter: {
      min: remoteAfter?.min,
      base: remoteAfter?.base,
      max: remoteAfter?.max,
    },
    pass: remoteAfter?.min === testMin,
    note: "La UI de PriceLabs lee estos mismos valores vía API. Configure prices debe mostrar min=" + testMin,
  });

  await persistLocalLikeApp(PROPERTY_ID, LISTING_ID, {
    min: testMin,
    base: remoteAfter?.base ?? beforeLocal.base,
    max: remoteAfter?.max ?? beforeLocal.max,
  });
  const afterLocal = await readLocal(PROPERTY_ID);
  const afterLocalReread = await readLocal(PROPERTY_ID);
  report.steps.push({
    step: 4,
    action: "Persistencia PRAGMA tras guardado",
    localAfter: afterLocal,
    localAfterReread: afterLocalReread,
    pass: afterLocalReread.min === testMin,
  });

  const dateFrom = isoToday();
  const dateTo = isoPlus(30);
  const pricesRes = await pl(apiKey, "/v1/listing_prices", {
    method: "POST",
    body: {
      listings: [
        {
          id: LISTING_ID,
          pms: "airbnb",
          date_from: dateFrom,
          date_to: dateTo,
          reason: true,
        },
      ],
    },
  });
  const rows = pricesRes.payload.listings ?? pricesRes.payload.data ?? pricesRes.payload.results ?? [];
  const priceRow = Array.isArray(rows) ? rows[0] : pricesRes.payload;
  const days =
    priceRow?.data ??
    priceRow?.prices ??
    priceRow?.days ??
    priceRow?.calendar ??
    [];
  const calendar = analyzeCalendar(days, testMin);

  const plRow = await db.propertyPriceLabs.findUnique({
    where: { propertyId: PROPERTY_ID },
    select: { meta: true },
  });
  const meta = plRow?.meta && typeof plRow.meta === "object" ? plRow.meta : {};
  const syncedDays = Array.isArray(meta.dailyPrices) ? meta.dailyPrices : [];
  const pragmaCalendar = analyzeCalendar(
    syncedDays.map((d) => ({
      date: d.date,
      recommended_price: d.recommended_price ?? d.price,
      price: d.price,
      min_stay: d.min_stay,
      pricing_reason: d.pricing_reason,
    })),
    testMin,
  );

  report.steps.push({
    step: 5,
    action: `Calendario futuro ${dateFrom} → ${dateTo}`,
    httpStatus: pricesRes.status,
    summary: {
      apiFutureDays: calendar.dayCount,
      apiLowestRecommended: calendar.minPrice,
      apiDaysBelowNewMin: calendar.belowMin.length,
      pragmaSyncedDays: pragmaCalendar.dayCount,
      pragmaLowestRecommended: pragmaCalendar.minPrice,
      pragmaHighestRecommended: pragmaCalendar.maxPrice,
      pragmaDaysBelowNewMin: pragmaCalendar.belowMin.length,
      pragmaSampleBelowMin: pragmaCalendar.belowMin.slice(0, 5),
      newMinBound: testMin,
      rawPriceRowKeys: priceRow ? Object.keys(priceRow) : [],
      priceRowError: priceRow?.error ?? priceRow?.message ?? null,
    },
    pass:
      calendar.belowMin.length === 0 &&
      (pragmaCalendar.dayCount === 0 || pragmaCalendar.belowMin.length === 0),
    note:
      pragmaCalendar.dayCount > 0
        ? `Calendario PRAGMA (${pragmaCalendar.dayCount}d): piso ${pragmaCalendar.minPrice} ≥ mín ${testMin}`
        : calendar.dayCount > 0
          ? `API calendario (${calendar.dayCount}d) respeta mínimo`
          : "Sin días en API live; validar calendario sincronizado en PRAGMA",
  });

  const overridesRes = await pl(
    apiKey,
    `/v1/listings/${LISTING_ID}/overrides?pms=airbnb`,
  );
  const overrides = overridesRes.payload.overrides ?? overridesRes.payload.data ?? [];
  const futureOverrides = overrides.filter((o) => o.date >= dateFrom);
  const minPriceOverrides = futureOverrides.filter((o) => o.min_price != null);
  const fixedPriceOverrides = futureOverrides.filter((o) => o.price != null);
  const minStayOverrides = futureOverrides.filter(
    (o) => o.min_stay != null && o.min_stay > 1,
  );

  report.steps.push({
    step: 6,
    action: "Reglas que pueden bloquear el nuevo mínimo",
    overrides: {
      totalFuture: futureOverrides.length,
      withFixedPrice: fixedPriceOverrides.length,
      withMinPriceFloor: minPriceOverrides.length,
      withElevatedMinStay: minStayOverrides.length,
      samples: {
        fixedPrice: fixedPriceOverrides.slice(0, 3),
        minPrice: minPriceOverrides.slice(0, 3),
        minStay: minStayOverrides.slice(0, 3),
      },
    },
    calendarSignals: {
      overrideReasonDays: calendar.withOverrideSignal.length,
      elevatedMinStayDays: calendar.highMinStay.length,
    },
    pass:
      minPriceOverrides.filter((o) => o.min_price > testMin).length === 0 &&
      fixedPriceOverrides.length === 0,
  });

  if (minPriceOverrides.some((o) => o.min_price > testMin)) {
    report.blockers.push(
      "DSO con min_price superior al nuevo mínimo global — mantiene piso artificialmente alto en esas fechas",
    );
  }
  if (fixedPriceOverrides.length > 0) {
    report.blockers.push(
      "DSO con precio fijo en fechas futuras — ignora el mínimo global para esas fechas",
    );
  }
  if (minStayOverrides.length > 0) {
    report.blockers.push(
      "DSO con min_stay elevado — no sube precio pero puede reducir reservas cortas",
    );
  }
  if (calendar.highMinStay.length > 5) {
    report.blockers.push(
      "Muchos días con estancia mínima ≥5 noches en calendario PL",
    );
  }

  report.priceLabsConfigsThatCanKeepPricesHigh = [
    {
      config: "Date-specific overrides (DSO) con precio fijo",
      impact: "Precio fijo independiente del mínimo global",
      found: fixedPriceOverrides.length > 0,
      count: fixedPriceOverrides.length,
    },
    {
      config: "DSO con min_price por fecha",
      impact: "Piso diario mayor que el mínimo global",
      found: minPriceOverrides.length > 0,
      count: minPriceOverrides.length,
    },
    {
      config: "Customizations / seasonal profiles (PriceLabs dashboard)",
      impact: "Ajustes % que elevan precios sobre el algoritmo base",
      found: "no expuesto en Customer API — revisar manualmente en PL dashboard",
      count: null,
    },
    {
      config: "Occupancy-based / demand adjustments",
      impact: "Suben precios cuando hay demanda aunque el mínimo bajó",
      found: calendar.minPrice != null && calendar.minPrice > testMin * 1.5,
      note: `Precio más bajo del calendario (${calendar.minPrice}) vs mínimo (${testMin})`,
    },
    {
      config: "Base price alto vs mínimo bajo",
      impact: "El algoritmo ancla en base; mínimo solo es piso",
      found: (remoteAfter?.base ?? 0) > testMin * 1.2,
      note: `Base ${remoteAfter?.base} vs min ${testMin}`,
    },
    {
      config: "push_enabled / last_refreshed_at",
      impact: "Si push deshabilitado, canales externos no reciben precios",
      found: remoteAfter?.push_enabled === false,
      value: remoteAfter?.push_enabled,
    },
  ];

  if (!hasFlag("--keep-change")) {
    const revert = await pl(apiKey, "/v1/listings", {
      method: "POST",
      body: {
        listings: [{ id: LISTING_ID, pms: "airbnb", min: originalMin }],
      },
    });
    await persistLocalLikeApp(PROPERTY_ID, LISTING_ID, {
      min: originalMin,
      base: remoteAfter?.base,
      max: remoteAfter?.max,
    });
    report.steps.push({
      step: 7,
      action: `Revertido mínimo a ${originalMin}`,
      httpStatus: revert.status,
      pass: revert.status === 200,
    });
  } else {
    report.steps.push({
      step: 7,
      action: "Cambio conservado (--keep-change)",
      pass: true,
    });
  }

  const allPass = report.steps.every((s) => s.pass !== false);
  report.verdict = allPass
    ? "OPERATIVO OK — mínimo baja, PL lo refleja, PRAGMA persiste, calendario respeta piso"
    : "REVISAR — hay pasos con fallo o bloqueadores activos";

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = allPass ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
