/**
 * Read-only audit: measures fallback grossAmount usage in enrichment write path.
 * node scripts/_audit-fallback-gross-readonly.mjs
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickReservationAmount(signals) {
  const host = readNumber(signals.hostPayoutAmount);
  if (host != null) return { amount: host, source: "hostPayout" };
  const net = readNumber(signals.netPayout);
  if (net != null) return { amount: net, source: "netPayout" };
  const gross = readNumber(signals.grossAmount);
  if (gross != null) return { amount: gross, source: "fallbackGross" };
  return { amount: null, source: "none" };
}

async function main() {
  const events = await db.reservationEmailEvent.findMany({
    where: {
      eventKind: "CONFIRMED",
      reservationId: { not: null },
    },
    select: {
      reservationId: true,
      enrichedFields: true,
      payload: true,
    },
    take: 5000,
    orderBy: { createdAt: "desc" },
  });

  const bySource = {
    hostPayout: 0,
    netPayout: 0,
    fallbackGross: 0,
    none: 0,
  };

  const fallbackOnly = [];

  for (const row of events) {
    const enriched =
      row.enrichedFields && typeof row.enrichedFields === "object"
        ? row.enrichedFields
        : {};
    const payload =
      row.payload && typeof row.payload === "object" ? row.payload : {};
    const signals =
      payload.signals && typeof payload.signals === "object"
        ? payload.signals
        : enriched;

    const picked = pickReservationAmount(signals);
    bySource[picked.source] += 1;

    if (picked.source === "fallbackGross") {
      fallbackOnly.push({
        reservationId: row.reservationId,
        hostPayoutAmount: signals.hostPayoutAmount ?? null,
        netPayout: signals.netPayout ?? null,
        grossAmount: signals.grossAmount ?? null,
        guestTotalPaid: signals.guestTotalPaid ?? null,
        amount: picked.amount,
      });
    }
  }

  console.log(JSON.stringify({ total: events.length, bySource, fallbackOnlySample: fallbackOnly.slice(0, 20) }, null, 2));
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
