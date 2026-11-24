/**
 * One-shot: clear orphaned PriceLabs syncInProgressAt locks older than TTL.
 *   npx tsx scripts/_clear-pricelabs-stale-locks.ts
 *   npx tsx scripts/_clear-pricelabs-stale-locks.ts --org-id <id>
 *   npx tsx scripts/_clear-pricelabs-stale-locks.ts --force  (clear even if fresh)
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const LOCK_STALE_MS = 5 * 60 * 1000;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const orgId = arg("--org-id");
  const force = process.argv.includes("--force");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS);

  try {
    const where = {
      provider: "PRICELABS" as const,
      syncInProgressAt: force
        ? { not: null }
        : { lte: staleBefore },
      ...(orgId ? { organizationId: orgId } : {}),
    };

    const before = await db.organizationIntegration.findMany({
      where,
      select: {
        organizationId: true,
        syncInProgressAt: true,
        status: true,
      },
    });

    const result = await db.organizationIntegration.updateMany({
      where,
      data: { syncInProgressAt: null },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          cleared: result.count,
          force,
          staleBefore: staleBefore.toISOString(),
          rows: before,
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
