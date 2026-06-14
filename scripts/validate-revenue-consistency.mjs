/**
 * Validación de consistencia end-to-end del módulo Revenue / PriceLabs.
 *
 * Casos:
 *   1. Modificar precio mínimo
 *   2. Modificar precio base
 *   3. Eliminar precio máximo (debe persistir tras relectura)
 *
 * Uso:
 *   node scripts/validate-revenue-consistency.mjs
 *   node scripts/validate-revenue-consistency.mjs --keep-change
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
const STALE_SYNC_MS = 24 * 60 * 60 * 1000;

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

function isMeaningfulMax(value) {
  return value != null && value > 0;
}

function hasCanonicalBounds(meta) {
  return meta?.bounds?.updatedAt != null;
}

/** Réplica de resolveCanonicalBounds (service.ts) para validar lectura unificada. */
function resolveCanonicalBounds(meta, propertyBaseRate) {
  const listing = meta?.listing;
  const bounds = meta?.bounds;
  const canonical = hasCanonicalBounds(meta);

  const propertyBase =
    propertyBaseRate != null ? Number.parseFloat(String(propertyBaseRate)) : null;

  if (!canonical && !listing) {
    return { min: null, base: propertyBase, max: null };
  }

  const min = canonical ? (bounds?.min ?? listing?.min) : listing?.min;
  const base = canonical
    ? (bounds?.base ?? listing?.base ?? propertyBase)
    : (listing?.base ?? propertyBase);
  const max = canonical
    ? bounds?.max === null
      ? null
      : (bounds?.max ?? listing?.max)
    : listing?.max;

  return { min: min ?? null, base: base ?? null, max: max === undefined ? null : max };
}

function resolvePortfolioLastPricesSyncAt(properties, orgLast) {
  let latest = null;
  const consider = (iso) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t) && (latest == null || t > latest)) latest = t;
  };
  for (const p of properties) {
    const meta = p.priceLabs?.meta ?? {};
    consider(meta.lastPricesSync);
    consider(meta.lastBoundsUpdate);
    consider(meta.bounds?.updatedAt);
  }
  if (orgLast) consider(orgLast.toISOString?.() ?? orgLast);
  return latest != null ? new Date(latest).toISOString() : null;
}

function pricingHealthFromSync(lastPricesSyncAt) {
  if (!lastPricesSyncAt) return { status: "never", health: "unknown" };
  const age = Date.now() - new Date(lastPricesSyncAt).getTime();
  if (age <= STALE_SYNC_MS) return { status: "fresh", health: "healthy" };
  return { status: "stale", health: "attention" };
}

async function readSnapshot(db, propertyId) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    include: { priceLabs: true },
  });
  const meta =
    property?.priceLabs?.meta && typeof property.priceLabs.meta === "object"
      ? property.priceLabs.meta
      : {};
  const canonical = resolveCanonicalBounds(meta, property?.baseRate?.toString());
  return {
    propertyBase: property?.baseRate?.toString() ?? null,
    listing: meta.listing ?? {},
    bounds: meta.bounds ?? null,
    canonical,
    priceDelta: property?.priceLabs?.priceDelta?.toString() ?? null,
    lastPricesSync: meta.lastPricesSync ?? null,
    lastBoundsUpdate: meta.lastBoundsUpdate ?? null,
  };
}

async function persistLikeApp(db, propertyId, listingId, { min, base, max, maxCleared }) {
  const row = await db.propertyPriceLabs.findUnique({ where: { propertyId } });
  const existingMeta =
    row?.meta && typeof row.meta === "object" ? { ...row.meta } : {};
  const now = new Date().toISOString();

  const bounds = {
    updatedAt: now,
    min: min ?? null,
    base: base ?? null,
    max: maxCleared ? null : max ?? null,
  };

  const listing = { ...(existingMeta.listing ?? { id: listingId }), id: listingId };
  if (bounds.min != null) listing.min = bounds.min;
  else delete listing.min;
  if (bounds.base != null) listing.base = bounds.base;
  if (bounds.max === null) delete listing.max;
  else if (isMeaningfulMax(bounds.max)) listing.max = bounds.max;

  const meta = {
    ...existingMeta,
    bounds,
    listing,
    lastListingRefresh: now,
    lastBoundsUpdate: now,
    lastPricesSync: now,
  };

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

  await db.organizationIntegration.update({
    where: {
      organizationId_provider: {
        organizationId: ORG_ID,
        provider: OrganizationIntegrationProvider.PRICELABS,
      },
    },
    data: { lastPricesSyncAt: new Date() },
  });
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const apiKey = await resolveApiKey(db);
  if (!apiKey) throw new Error("Sin API key PriceLabs");

  const report = {
    testAt: new Date().toISOString(),
    propertyId: PROPERTY_ID,
    listingId: LISTING_ID,
    cases: [],
    verdict: null,
  };

  const before = await readSnapshot(db, PROPERTY_ID);
  const listingsRes = await pl(apiKey, "/v1/listings");
  const remoteBefore = (listingsRes.payload.listings ?? []).find(
    (l) => String(l.id) === LISTING_ID,
  );

  const original = {
    min: remoteBefore?.min ?? before.canonical.min,
    base: remoteBefore?.base ?? before.canonical.base,
    max: remoteBefore?.max ?? before.canonical.max,
  };

  async function runCase(name, mutateRemote, mutateLocal, assertFn) {
    const step = { name, steps: [], pass: false };
    report.cases.push(step);

    const remotePayload = await mutateRemote();
    step.steps.push({ action: "PriceLabs API", ...remotePayload });

    await mutateLocal(remotePayload.remoteAfter ?? remoteBefore);
    const afterSave = await readSnapshot(db, PROPERTY_ID);
    const afterReread = await readSnapshot(db, PROPERTY_ID);
    step.steps.push({
      action: "Persistencia PRAGMA + relectura",
      afterSave,
      afterReread,
      canonicalMatch:
        JSON.stringify(afterSave.canonical) === JSON.stringify(afterReread.canonical),
    });

    const orgRow = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: ORG_ID,
          provider: OrganizationIntegrationProvider.PRICELABS,
        },
      },
      select: { lastPricesSyncAt: true },
    });
    const allProps = await db.property.findMany({
      where: {
        organizationId: ORG_ID,
        status: "ACTIVE",
      },
      include: { priceLabs: true },
    });
    const effectiveSync = resolvePortfolioLastPricesSyncAt(
      allProps,
      orgRow?.lastPricesSyncAt,
    );
    const health = pricingHealthFromSync(effectiveSync);
    step.steps.push({
      action: "Salud Pricing (timestamp efectivo)",
      effectiveLastPricesSyncAt: effectiveSync,
      health,
    });

    step.pass = assertFn({
      remote: remotePayload.remoteAfter,
      local: afterReread,
      effectiveSync,
      health,
    });
    return step.pass;
  }

  // Caso 1: mínimo
  const testMin = (original.min ?? 175300) - 3000;
  await runCase(
    "Caso 1 — modificar precio mínimo",
    async () => {
      const post = await pl(apiKey, "/v1/listings", {
        method: "POST",
        body: { listings: [{ id: LISTING_ID, pms: "airbnb", min: testMin }] },
      });
      const verify = await pl(apiKey, "/v1/listings");
      const remoteAfter = (verify.payload.listings ?? []).find(
        (l) => String(l.id) === LISTING_ID,
      );
      return { httpStatus: post.status, remoteAfter, pass: post.status === 200 };
    },
    async (remote) => {
      await persistLikeApp(db, PROPERTY_ID, LISTING_ID, {
        min: testMin,
        base: remote?.base ?? original.base,
        max: remote?.max ?? original.max,
        maxCleared: false,
      });
    },
    ({ remote, local }) =>
      remote?.min === testMin && local.canonical.min === testMin,
  );

  // Caso 2: base
  const testBase = (original.base ?? 200000) + 2000;
  await runCase(
    "Caso 2 — modificar precio base",
    async () => {
      const post = await pl(apiKey, "/v1/listings", {
        method: "POST",
        body: { listings: [{ id: LISTING_ID, pms: "airbnb", base: testBase }] },
      });
      const verify = await pl(apiKey, "/v1/listings");
      const remoteAfter = (verify.payload.listings ?? []).find(
        (l) => String(l.id) === LISTING_ID,
      );
      return { httpStatus: post.status, remoteAfter, pass: post.status === 200 };
    },
    async (remote) => {
      await persistLikeApp(db, PROPERTY_ID, LISTING_ID, {
        min: remote?.min ?? testMin,
        base: testBase,
        max: remote?.max ?? original.max,
        maxCleared: false,
      });
    },
    ({ remote, local }) =>
      remote?.base === testBase && local.canonical.base === testBase,
  );

  // Caso 3: eliminar máximo
  await runCase(
    "Caso 3 — eliminar precio máximo",
    async () => {
      const post = await pl(apiKey, "/v1/listings", {
        method: "POST",
        body: {
          listings: [{ id: LISTING_ID, pms: "airbnb", max: null }],
        },
      });
      const verify = await pl(apiKey, "/v1/listings");
      const remoteAfter = (verify.payload.listings ?? []).find(
        (l) => String(l.id) === LISTING_ID,
      );
      return {
        httpStatus: post.status,
        remoteAfter,
        remoteMaxAfterClear: remoteAfter?.max ?? null,
        pass: post.status === 200,
      };
    },
    async (remote) => {
      await persistLikeApp(db, PROPERTY_ID, LISTING_ID, {
        min: remote?.min ?? testMin,
        base: remote?.base ?? testBase,
        max: null,
        maxCleared: true,
      });
    },
    ({ local, health }) =>
      local.bounds?.max === null &&
      local.canonical.max === null &&
      local.listing.max === undefined &&
      health.status === "fresh",
  );

  if (!hasFlag("--keep-change")) {
    const revert = await pl(apiKey, "/v1/listings", {
      method: "POST",
      body: {
        listings: [
          {
            id: LISTING_ID,
            pms: "airbnb",
            min: original.min,
            base: original.base,
            ...(isMeaningfulMax(original.max) ? { max: original.max } : {}),
          },
        ],
      },
    });
    await persistLikeApp(db, PROPERTY_ID, LISTING_ID, {
      min: original.min,
      base: original.base,
      max: original.max,
      maxCleared: !isMeaningfulMax(original.max),
    });
    report.revert = { httpStatus: revert.status, pass: revert.status === 200 };
  }

  const allPass = report.cases.every((c) => c.pass);
  report.verdict = allPass
    ? "CONSISTENCIA OK — min/base/max, bounds canónicos y Salud Pricing alineados"
    : "FALLO — revisar casos con pass=false";

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
