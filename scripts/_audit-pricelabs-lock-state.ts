/**
 * Read PriceLabs syncInProgressAt for an org.
 *   npx tsx scripts/_audit-pricelabs-lock-state.ts [orgId]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

async function main() {
  const orgId = process.argv[2] || "cmplxfg0a000105jrs0gqtwyc";
  const LOCK_STALE_MS = 5 * 60 * 1000;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const row = await db.organizationIntegration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: orgId,
          provider: "PRICELABS",
        },
      },
      select: {
        syncInProgressAt: true,
        lastError: true,
        status: true,
        lastPricesSyncAt: true,
        lastListingsSyncAt: true,
        updatedAt: true,
        isConnected: true,
      },
    });
    const ageMs = row?.syncInProgressAt
      ? Date.now() - new Date(row.syncInProgressAt).getTime()
      : null;
    console.log(
      JSON.stringify(
        {
          orgId,
          row,
          ageSec: ageMs != null ? Math.round(ageMs / 1000) : null,
          wouldBlockAcquire:
            row?.syncInProgressAt != null &&
            new Date(row.syncInProgressAt).getTime() > Date.now() - LOCK_STALE_MS,
        },
        null,
        2,
      ),
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
