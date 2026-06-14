/**
 * Auditoría bidireccional PRAGMA ↔ PriceLabs (min/base/max).
 *
 * Casos:
 *   1. PRAGMA → PriceLabs (save simulado como app + verificación API)
 *   2. PriceLabs → PRAGMA (cambio solo remoto + sync listings)
 *   3. Relectura tras refresh en ambos lados
 *
 *   node scripts/audit-pricelabs-bidirectional.mjs
 */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { createDecipheriv, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrganizationIntegrationProvider } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const PROPERTY_ID = "cmpm0xani000004jgxfqjnih0";
const LISTING_ID = "1659835181966511536";
const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(
  /\/$/,
  "",
);
const SECRET_PREFIX = "enc:v1:";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

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
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
    .toString("utf8")
    .trim();
}

async function resolveApiKey() {
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
  return { status: response.status, payload };
}

function hasCanonicalBounds(meta) {
  return meta?.bounds?.updatedAt != null;
}

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

  return { min: min ?? null, base: base ?? null, max: max ?? null };
}

async function readPragmaSnapshot() {
  const property = await db.property.findUnique({
    where: { id: PROPERTY_ID },
    include: { priceLabs: true },
  });
  const meta =
    property?.priceLabs?.meta && typeof property.priceLabs.meta === "object"
      ? property.priceLabs.meta
      : {};
  return {
    propertyBase: property?.baseRate?.toString() ?? null,
    bounds: meta.bounds ?? null,
    listingMeta: meta.listing ?? null,
    canonical: resolveCanonicalBounds(meta, property?.baseRate?.toString()),
    lastBoundsUpdate: meta.lastBoundsUpdate ?? null,
    lastListingRefresh: meta.lastListingRefresh ?? null,
  };
}

async function readRemoteListing(apiKey) {
  const res = await pl(apiKey, "/v1/listings");
  const listing = (res.payload.listings ?? []).find(
    (l) => String(l.id) === LISTING_ID,
  );
  return {
    httpStatus: res.status,
    min: listing?.min ?? null,
    base: listing?.base ?? null,
    max: listing?.max ?? null,
    last_date_pushed: listing?.last_date_pushed ?? null,
    last_refreshed_at: listing?.last_refreshed_at ?? null,
    raw: listing ?? null,
  };
}

function triplesMatch(a, b) {
  return a.min === b.min && a.base === b.base && a.max === b.max;
}

async function persistLikePragmaSave({ min, base, max, maxCleared = false }) {
  const row = await db.propertyPriceLabs.findUnique({ where: { propertyId: PROPERTY_ID } });
  const existingMeta =
    row?.meta && typeof row.meta === "object" ? { ...row.meta } : {};
  const now = new Date().toISOString();

  const bounds = {
    updatedAt: now,
    min: min ?? null,
    base: base ?? null,
    max: maxCleared ? null : (max ?? null),
  };

  const listing = { ...(existingMeta.listing ?? { id: LISTING_ID }), id: LISTING_ID };
  if (bounds.min != null) listing.min = bounds.min;
  if (bounds.base != null) listing.base = bounds.base;
  if (bounds.max === null) delete listing.max;
  else if (bounds.max > 0) listing.max = bounds.max;

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
      where: { id: PROPERTY_ID },
      data: { baseRate: base },
    });
  }

  await db.propertyPriceLabs.upsert({
    where: { propertyId: PROPERTY_ID },
    create: {
      propertyId: PROPERTY_ID,
      listingId: LISTING_ID,
      syncStatus: "SYNCED",
      meta,
      lastSyncedAt: new Date(),
    },
    update: {
      listingId: LISTING_ID,
      syncStatus: "SYNCED",
      meta,
      lastSyncedAt: new Date(),
    },
  });
}

function runBoundsSyncOnce(apiKey) {
  const result = spawnSync(
    "npx",
    [
      "tsx",
      "scripts/apply-bounds-sync-once.ts",
      PROPERTY_ID,
      LISTING_ID,
    ],
    {
      encoding: "utf8",
      shell: true,
      cwd: process.cwd(),
      env: { ...process.env, PRICELABS_API_KEY: apiKey },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `apply-bounds-sync-once failed: ${result.stderr || result.stdout || result.status}`,
    );
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { raw: result.stdout };
  }
}

async function main() {
  const apiKey = await resolveApiKey();
  if (!apiKey) throw new Error("Sin API key PriceLabs");

  const report = {
    auditedAt: new Date().toISOString(),
    orgId: ORG_ID,
    propertyId: PROPERTY_ID,
    listingId: LISTING_ID,
    architecture: {
      webhooks: "No implementados (stub en src/integrations/pricelabs/webhooks.ts)",
      cron: "GET /api/cron/pricelabs-sync — pricesOnly + refreshListingBoundsFromRemote",
      manualFull: "Integraciones → Pipeline completo (listings + precios)",
      manualListings: "Integraciones → Importar listings",
      revenueSourceOfTruth:
        "meta.bounds (canónico) con resolución: timestamp remoto O divergencia vs meta.listing",
      cache: "PropertyPriceLabs.meta + Property.baseRate — sin caché HTTP",
    },
    cases: [],
    verdict: null,
  };

  const baselineRemote = await readRemoteListing(apiKey);
  const baselinePragma = await readPragmaSnapshot();

  const original = {
    min: baselineRemote.min ?? baselinePragma.canonical.min,
    base: baselineRemote.base ?? baselinePragma.canonical.base,
    max: baselineRemote.max ?? baselinePragma.canonical.max,
  };

  // CASO 1 — PRAGMA → PriceLabs
  const case1 = {
    name: "Caso 1 — PRAGMA → PriceLabs",
    steps: [],
    pass: false,
  };
  report.cases.push(case1);

  const testMinP2Pl = (original.min ?? 160000) + 1111;
  const testBaseP2Pl = (original.base ?? 220000) + 2222;

  await pl(apiKey, "/v1/listings", {
    method: "POST",
    body: {
      listings: [
        {
          id: LISTING_ID,
          pms: "airbnb",
          min: testMinP2Pl,
          base: testBaseP2Pl,
          max: null,
        },
      ],
    },
  });
  await persistLikePragmaSave({
    min: testMinP2Pl,
    base: testBaseP2Pl,
    max: null,
    maxCleared: true,
  });

  const remoteAfterP2Pl = await readRemoteListing(apiKey);
  const pragmaAfterP2Pl = await readPragmaSnapshot();

  case1.steps.push({
    action: "Guardar en PRAGMA + POST PriceLabs (como savePropertyPriceBoundsFromPanel)",
    expected: { min: testMinP2Pl, base: testBaseP2Pl, max: null },
    remote: remoteAfterP2Pl,
    pragma: pragmaAfterP2Pl,
  });

  case1.pass =
    remoteAfterP2Pl.min === testMinP2Pl &&
    remoteAfterP2Pl.base === testBaseP2Pl &&
    (remoteAfterP2Pl.max == null || remoteAfterP2Pl.max === 0) &&
    pragmaAfterP2Pl.canonical.min === testMinP2Pl &&
    pragmaAfterP2Pl.canonical.base === testBaseP2Pl &&
    pragmaAfterP2Pl.canonical.max === null;

  // CASO 2 — PriceLabs → PRAGMA (solo remoto, luego sync)
  const case2 = {
    name: "Caso 2 — PriceLabs → PRAGMA",
    steps: [],
    pass: false,
  };
  report.cases.push(case2);

  const testMinPl2P = testMinP2Pl - 3333;
  const testBasePl2P = testBaseP2Pl + 3333;

  const postRemoteOnly = await pl(apiKey, "/v1/listings", {
    method: "POST",
    body: {
      listings: [
        {
          id: LISTING_ID,
          pms: "airbnb",
          min: testMinPl2P,
          base: testBasePl2P,
        },
      ],
    },
  });

  const pragmaBeforeSync = await readPragmaSnapshot();
  const remoteBeforeSync = await readRemoteListing(apiKey);

  case2.steps.push({
    action: "Cambio SOLO en PriceLabs (sin tocar PRAGMA)",
    postStatus: postRemoteOnly.status,
    remoteBeforeSync,
    pragmaBeforeSync,
    pragmaStillStale:
      pragmaBeforeSync.canonical.min !== testMinPl2P ||
      pragmaBeforeSync.canonical.base !== testBasePl2P,
  });

  const syncResult = runBoundsSyncOnce(apiKey);
  const pragmaAfterSync = await readPragmaSnapshot();
  const remoteAfterSync = await readRemoteListing(apiKey);

  case2.steps.push({
    action: "apply-bounds-sync-once (misma resolución que syncListings)",
    syncResult,
    remoteAfterSync,
    pragmaAfterSync,
    adopted:
      pragmaAfterSync.canonical.min === testMinPl2P &&
      pragmaAfterSync.canonical.base === testBasePl2P,
  });

  case2.pass =
    remoteAfterSync.min === testMinPl2P &&
    remoteAfterSync.base === testBasePl2P &&
    pragmaAfterSync.canonical.min === testMinPl2P &&
    pragmaAfterSync.canonical.base === testBasePl2P &&
    pragmaAfterSync.propertyBase === String(testBasePl2P);

  // CASO 3 — Persistencia tras refresh
  const case3 = {
    name: "Caso 3 — Persistencia tras refresh",
    steps: [],
    pass: false,
  };
  report.cases.push(case3);

  const pragmaReread = await readPragmaSnapshot();
  const remoteReread = await readRemoteListing(apiKey);

  case3.steps.push({
    action: "Relectura PRAGMA + GET PriceLabs",
    pragma: pragmaReread,
    remote: remoteReread,
    aligned: triplesMatch(pragmaReread.canonical, {
      min: remoteReread.min,
      base: remoteReread.base,
      max: remoteReread.max ?? null,
    }),
  });

  case3.pass =
    triplesMatch(pragmaReread.canonical, {
      min: remoteReread.min,
      base: remoteReread.base,
      max: remoteReread.max ?? null,
    }) && pragmaReread.propertyBase === String(remoteReread.base);

  // Revertir remoto
  await pl(apiKey, "/v1/listings", {
    method: "POST",
    body: {
      listings: [
        {
          id: LISTING_ID,
          pms: "airbnb",
          min: original.min,
          base: original.base,
          max: original.max ?? null,
        },
      ],
    },
  });
  await persistLikePragmaSave({
    min: original.min,
    base: original.base,
    max: original.max,
    maxCleared: original.max == null,
  });
  runBoundsSyncOnce(apiKey);

  const allPass = case1.pass && case2.pass && case3.pass;
  report.verdict = allPass
    ? "BIDIRECCIONAL OK — PRAGMA y PriceLabs alineados en ambos sentidos"
    : "BIDIRECCIONAL FAIL — revisar casos con pass=false";
  report.revertedTo = original;

  const outPath = join(process.cwd(), "scripts", "audit-pricelabs-bidirectional-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = allPass ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
