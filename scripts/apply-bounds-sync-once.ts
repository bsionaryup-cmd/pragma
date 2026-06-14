/**
 * Aplica resolveListingBoundsForSync para una propiedad (auditoría / pruebas).
 *
 *   npx tsx scripts/apply-bounds-sync-once.ts <propertyId> <listingId>
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import type { StoredPriceLabsMeta } from "@/integrations/pricelabs/types";
import {
  normalizeRemoteListingRaw,
  resolveListingBoundsForSync,
} from "@/integrations/pricelabs/bounds-sync-resolution";
import type { PriceLabsListingRecord } from "@/integrations/pricelabs/types";

config();
config({ path: ".env.local", override: true });

const propertyId = process.argv[2];
const listingId = process.argv[3];
const apiKey = process.env.PRICELABS_API_KEY?.trim();

if (!propertyId || !listingId) {
  console.error("Uso: npx tsx scripts/apply-bounds-sync-once.ts <propertyId> <listingId>");
  process.exit(1);
}

const API_BASE = (process.env.PRICELABS_BASE_URL || "https://api.pricelabs.co").replace(
  /\/$/,
  "",
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function resolveKey() {
  if (apiKey) return apiKey;
  const row = await db.organizationIntegration.findFirst({
    where: { provider: "PRICELABS" },
    select: { apiKeyEncrypted: true },
  });
  return row?.apiKeyEncrypted ?? null;
}

async function main() {
  const key = await resolveKey();
  if (!key) throw new Error("Sin API key");

  const res = await fetch(`${API_BASE}/v1/listings`, {
    headers: { "X-API-Key": key, Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await res.json();
  const raw = (payload.listings ?? []).find((l: { id: string | number }) => String(l.id) === listingId);
  if (!raw) throw new Error("Listing no encontrado en PriceLabs");

  const remoteListing = normalizeRemoteListingRaw(raw) as PriceLabsListingRecord;
  const row = await db.propertyPriceLabs.findUnique({ where: { propertyId } });
  const priorMeta: StoredPriceLabsMeta =
    row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as StoredPriceLabsMeta)
      : {};

  const resolution = resolveListingBoundsForSync(priorMeta, remoteListing);
  const refreshAt = new Date().toISOString();
  const meta: StoredPriceLabsMeta = {
    ...priorMeta,
    listing: resolution.listing,
    lastListingRefresh: refreshAt,
    ...(resolution.bounds
      ? {
          bounds: resolution.bounds,
          lastBoundsUpdate: resolution.bounds.updatedAt ?? refreshAt,
        }
      : {}),
  };

  if (resolution.adoptedFromRemote && resolution.baseRateToPersist != null) {
    await db.property.update({
      where: { id: propertyId },
      data: { baseRate: resolution.baseRateToPersist },
    });
  }

  await db.propertyPriceLabs.upsert({
    where: { propertyId },
    create: {
      propertyId,
      listingId,
      syncStatus: "SYNCED",
      meta: meta as object,
      lastSyncedAt: new Date(),
    },
    update: {
      listingId,
      syncStatus: "SYNCED",
      meta: meta as object,
      lastSyncedAt: new Date(),
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        adoptedFromRemote: resolution.adoptedFromRemote,
        bounds: resolution.bounds ?? null,
        baseRateToPersist: resolution.baseRateToPersist,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
