/**
 * Probe PriceLabs for listing-level minimum stay (not per-day DSO).
 * Usage: npx tsx scripts/probe-pricelabs-minstay.mjs
 */
import { config } from "dotenv";
import { createDecipheriv, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrganizationIntegrationProvider } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const SECRET_PREFIX = "enc:v1:";
const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(
  /\/$/,
  "",
);

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
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  ).trim();
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
    payload = { message: raw.slice(0, 400) };
  }
  return { status: response.status, payload };
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const row = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: ORG_ID,
          provider: OrganizationIntegrationProvider.PRICELABS,
        },
      },
      select: { apiKeyEncrypted: true },
    });
    const apiKey =
      decryptSecret(row?.apiKeyEncrypted) ||
      process.env.PRICELABS_API_KEY?.trim() ||
      null;
    if (!apiKey) throw new Error("Sin API key");

    const props = await db.property.findMany({
      where: {
        organizationId: ORG_ID,
        priceLabs: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        unitNumber: true,
        priceLabs: { select: { listingId: true, meta: true } },
      },
      take: 8,
    });

    console.log(
      JSON.stringify(
        {
          properties: props.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unitNumber,
            listingId: p.priceLabs?.listingId,
            pms: p.priceLabs?.meta?.listing?.pms ?? null,
          })),
        },
        null,
        2,
      ),
    );

    const target =
      props.find((p) => String(p.unitNumber || "").includes("804")) ||
      props.find((p) => p.priceLabs?.listingId) ||
      props[0];
    if (!target?.priceLabs?.listingId) throw new Error("Sin listing");

    const listingId = target.priceLabs.listingId;
    const pms =
      target.priceLabs?.meta?.listing?.pms?.trim() ||
      process.env.PRICELABS_PMS_NAME ||
      "other";

    console.log("\n=== TARGET ===", {
      name: target.name,
      unit: target.unitNumber,
      listingId,
      pms,
    });

    const listings = await pl(apiKey, "/v1/listings");
    const listing = (listings.payload?.listings || listings.payload?.data || []).find(
      (r) => String(r.id) === String(listingId),
    );
    console.log("\n=== LISTING FIELDS (keys) ===", listing ? Object.keys(listing) : listings);

    const keysToTry = [
      null,
      "last_minute_prices,far_out_premium",
      "min_stay,minimum_stay,minstay,stay_restrictions,minimum_stay_update,min_stay_update",
    ];

    for (const keys of keysToTry) {
      const qs = new URLSearchParams({
        listing_id: listingId,
        pms_name: pms,
        toggled_on: "false",
      });
      if (keys) qs.set("customizations", keys);
      const res = await pl(apiKey, `/v1/customizations/listing?${qs}`);
      console.log(`\n=== GET customizations keys=${keys ?? "(all)"} ===`, {
        status: res.status,
        payload: res.payload,
      });
    }

    // Probe unknown customization write (expect rejection if unsupported)
    const probeKeys = [
      "min_stay",
      "minimum_stay",
      "minstay",
      "stay_restrictions",
      "minimum_stay_update",
    ];
    for (const key of probeKeys) {
      const body = {
        listing_id: listingId,
        pms_name: pms,
        customizations: {
          [key]: { enabled: true, default_min_stay: 3 },
        },
      };
      const res = await pl(apiKey, "/v1/customizations/listing", {
        method: "POST",
        body,
      });
      console.log(`\n=== POST probe ${key} ===`, {
        status: res.status,
        payload: res.payload,
      });
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
