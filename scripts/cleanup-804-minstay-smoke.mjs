/**
 * Remove smoke-test DSO min_stay on unit 804 (2026-07-29 … 2026-08-04)
 * and clear meta.defaultMinStay if present.
 * Usage: node scripts/cleanup-804-minstay-smoke.mjs
 */
import { config } from "dotenv";
import { createDecipheriv, createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, OrganizationIntegrationProvider } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const SECRET_PREFIX = "enc:v1:";
const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(
  /\/$/,
  "",
);
const SMOKE_DATES = [
  "2026-07-29",
  "2026-07-30",
  "2026-07-31",
  "2026-08-01",
  "2026-08-02",
  "2026-08-03",
  "2026-08-04",
];

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
    const prop = await db.property.findFirst({
      where: { unitNumber: "804", priceLabs: { isNot: null } },
      select: {
        id: true,
        name: true,
        organizationId: true,
        priceLabs: { select: { listingId: true, meta: true } },
      },
    });
    if (!prop?.priceLabs?.listingId) throw new Error("804 not found");

    const org = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: prop.organizationId,
          provider: OrganizationIntegrationProvider.PRICELABS,
        },
      },
      select: { apiKeyEncrypted: true },
    });
    const apiKey = decryptSecret(org?.apiKeyEncrypted);
    if (!apiKey) throw new Error("no key");

    const listingId = prop.priceLabs.listingId;
    const pms = prop.priceLabs.meta?.listing?.pms || "airbnb";

    // Always clear local PRAGMA meta first (independent of PriceLabs reachability).
    const meta = { ...(prop.priceLabs.meta || {}) };
    if (meta.defaultMinStay) {
      delete meta.defaultMinStay;
      await db.propertyPriceLabs.update({
        where: { propertyId: prop.id },
        data: { meta },
      });
      console.log("Cleared meta.defaultMinStay on", prop.id);
    } else {
      console.log("No meta.defaultMinStay to clear");
    }

    let before;
    try {
      before = await pl(apiKey, `/v1/listings/${listingId}/overrides`);
    } catch (err) {
      console.error(
        "PriceLabs unreachable — local meta cleaned; delete overrides manually or re-run:",
        err?.cause?.code || err.message,
      );
      console.error("Target listing", listingId, "pms", pms, "dates", SMOKE_DATES.join(","));
      return;
    }

    const rows = before.payload?.overrides || before.payload?.data || [];
    const smokeRows = rows.filter((r) => SMOKE_DATES.includes(r.date));
    console.log(
      "BEFORE smoke dates",
      smokeRows.map((r) => ({
        date: r.date,
        min_stay: r.min_stay,
        price: r.price,
        min_price: r.min_price,
        max_price: r.max_price,
      })),
    );

    // Only delete dates that look like smoke-only min_stay (no price/min/max).
    const datesToDelete = smokeRows
      .filter(
        (r) =>
          r.min_stay != null &&
          r.price == null &&
          r.min_price == null &&
          r.max_price == null,
      )
      .map((r) => r.date);

    const leftoverWithOtherFields = smokeRows.filter(
      (r) =>
        r.min_stay != null &&
        (r.price != null || r.min_price != null || r.max_price != null),
    );

    if (datesToDelete.length) {
      console.log("DELETE dates", datesToDelete);
      const del = await pl(apiKey, `/v1/listings/${listingId}/overrides`, {
        method: "DELETE",
        body: { dates: datesToDelete, pms },
      });
      console.log("DELETE", del.status, JSON.stringify(del.payload).slice(0, 400));
    } else {
      console.log("No pure min_stay smoke rows to DELETE");
    }

    if (leftoverWithOtherFields.length) {
      console.warn(
        "WARN: smoke dates still have min_stay plus other fields — not auto-deleted:",
        leftoverWithOtherFields.map((r) => ({
          date: r.date,
          min_stay: r.min_stay,
          price: r.price,
        })),
      );
    }

    const after = await pl(apiKey, `/v1/listings/${listingId}/overrides`);
    const afterRows = after.payload?.overrides || after.payload?.data || [];
    console.log(
      "AFTER smoke dates",
      afterRows
        .filter((r) => SMOKE_DATES.includes(r.date))
        .map((r) => ({ date: r.date, min_stay: r.min_stay, price: r.price })),
    );
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
