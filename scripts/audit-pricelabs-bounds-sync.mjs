/**
 * Auditoría de sincronización PriceLabs — límites min/base/max.
 *
 * Uso:
 *   node scripts/audit-pricelabs-bounds-sync.mjs
 *   node scripts/audit-pricelabs-bounds-sync.mjs --org-id <id> --dry-run
 *   node scripts/audit-pricelabs-bounds-sync.mjs --org-id <id> --property-id <id> --field min --value 900
 */
import { config } from "dotenv";
import { createDecipheriv, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrganizationIntegrationProvider } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const SECRET_PREFIX = "enc:v1:";
const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(/\/$/, "");

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function getEncryptionKey() {
  const source =
    process.env.TTLOCK_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY ||
    process.env.DATABASE_URL;
  if (!source) throw new Error("No encryption key source in env");
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
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8").trim();
}

async function resolveApiKey(db, organizationId) {
  const envKey = process.env.PRICELABS_API_KEY?.trim() || process.env.PRICELABS_TOKEN?.trim();
  const row = await db.organizationIntegration.findUnique({
    where: {
      organizationId_provider: {
        organizationId,
        provider: OrganizationIntegrationProvider.PRICELABS,
      },
    },
    select: { apiKeyEncrypted: true },
  });
  const stored = decryptSecret(row?.apiKeyEncrypted);
  return stored || envKey || null;
}

async function priceLabsRequest(apiKey, path, { method = "GET", body } = {}) {
  const url = `${API_BASE}${path}`;
  const started = Date.now();
  const response = await fetch(url, {
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
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { message: raw.slice(0, 500) };
    }
  }
  return {
    url,
    method,
    status: response.status,
    elapsedMs: Date.now() - started,
    payload,
    requestBody: body ?? null,
  };
}

function pickListingBounds(listing) {
  return {
    id: listing?.id,
    min: listing?.min ?? listing?.min_price ?? null,
    base: listing?.base ?? listing?.base_price ?? null,
    max: listing?.max ?? listing?.max_price ?? null,
    pms: listing?.pms ?? null,
  };
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const dryRun = hasFlag("--dry-run");
  const orgId = arg("--org-id");
  const propertyId = arg("--property-id");
  const field = arg("--field", "min");
  const testValue = Number.parseInt(arg("--value", "0"), 10);

  const orgs = orgId
    ? await db.organization.findMany({ where: { id: orgId }, select: { id: true, name: true } })
    : await db.organization.findMany({
        where: {
          organizationIntegrations: {
            some: { provider: OrganizationIntegrationProvider.PRICELABS },
          },
        },
        select: { id: true, name: true },
        take: 5,
      });

  if (orgs.length === 0) {
    console.log("No organizations with PriceLabs integration found.");
    return;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apiEnabled: process.env.PRICELABS_API_ENABLED !== "false",
    pmsDefault: process.env.PRICELABS_PMS_NAME || "other",
    organizations: [],
  };

  for (const org of orgs) {
    const apiKey = await resolveApiKey(db, org.id);
    const orgReport = {
      organizationId: org.id,
      organizationName: org.name,
      apiKeyConfigured: Boolean(apiKey),
      apiKeyHint: apiKey ? `••••${apiKey.slice(-4)}` : null,
      properties: [],
      tests: [],
    };

    const properties = await db.property.findMany({
      where: {
        organizationId: org.id,
        status: "ACTIVE",
        ...(propertyId ? { id: propertyId } : {}),
      },
      include: { priceLabs: true },
      orderBy: { name: "asc" },
      take: propertyId ? 1 : 8,
    });

    for (const property of properties) {
      const meta =
        property.priceLabs?.meta &&
        typeof property.priceLabs.meta === "object" &&
        !Array.isArray(property.priceLabs.meta)
          ? property.priceLabs.meta
          : {};
      const listing = meta.listing ?? {};
      orgReport.properties.push({
        propertyId: property.id,
        propertyName: property.name,
        listingId: property.priceLabs?.listingId ?? null,
        local: {
          baseRate: property.baseRate?.toString() ?? null,
          min: listing.min ?? null,
          base: listing.base ?? null,
          max: listing.max ?? null,
          pms: listing.pms ?? null,
        },
        syncStatus: property.priceLabs?.syncStatus ?? null,
        lastError: property.priceLabs?.lastError ?? null,
      });
    }

    if (!apiKey) {
      report.organizations.push(orgReport);
      continue;
    }

    const listingsGet = await priceLabsRequest(apiKey, "/v1/listings");
    orgReport.tests.push({
      name: "GET /v1/listings",
      ...listingsGet,
      ok: listingsGet.status === 200,
    });

    const remoteListings = listingsGet.payload?.listings ?? listingsGet.payload?.data ?? [];
    const mapped = orgReport.properties
      .filter((p) => p.listingId)
      .map((p) => {
        const remote = remoteListings.find((row) => String(row.id) === String(p.listingId));
        return {
          propertyId: p.propertyId,
          listingId: p.listingId,
          remoteBefore: remote ? pickListingBounds(remote) : null,
        };
      });
    orgReport.remoteBefore = mapped;

    const target = mapped[0];
    if (target?.remoteBefore && !dryRun && Number.isFinite(testValue) && testValue > 0) {
      const pms = target.remoteBefore.pms || orgReport.properties[0]?.local?.pms || report.pmsDefault;
      const payload = {
        listings: [
          {
            id: target.listingId,
            pms,
            [field]: testValue,
          },
        ],
      };
      const post = await priceLabsRequest(apiKey, "/v1/listings", {
        method: "POST",
        body: payload,
      });
      orgReport.tests.push({
        name: `POST /v1/listings (${field}=${testValue})`,
        ...post,
        ok: post.status === 200,
      });

      const verify = await priceLabsRequest(apiKey, "/v1/listings");
      const remoteAfter = (verify.payload?.listings ?? []).find(
        (row) => String(row.id) === String(target.listingId),
      );
      orgReport.remoteAfter = remoteAfter ? pickListingBounds(remoteAfter) : null;

      const localRow = await db.propertyPriceLabs.findUnique({
        where: { propertyId: target.propertyId },
      });
      orgReport.localDbAfter = {
        syncStatus: localRow?.syncStatus ?? null,
        metaListing: localRow?.meta?.listing
          ? pickListingBounds(localRow.meta.listing)
          : null,
      };
    } else if (dryRun) {
      orgReport.tests.push({
        name: "POST /v1/listings",
        skipped: true,
        reason: "dry-run flag set",
      });
    }

    report.organizations.push(orgReport);
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
