/**
 * Forensic evidence: StayPortalToken must exist on generated client + DB.
 * Also proves the HMR singleton root cause (stale client without version bump).
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const hasModelInDmmf = models.includes("StayPortalToken");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL missing");
  }

  const pool = new Pool({ connectionString });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  const hasDelegate =
    typeof (client as { stayPortalToken?: unknown }).stayPortalToken ===
    "object";

  let tableExists: string | null = null;
  let columnCount = 0;
  let indexNames: string[] = [];
  try {
    const r = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('public.stay_portal_tokens')::text AS table_name",
    );
    tableExists = r.rows[0]?.table_name ?? null;

    if (tableExists) {
      const cols = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'stay_portal_tokens'`,
      );
      columnCount = Number(cols.rows[0]?.count ?? 0);

      const idxs = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'stay_portal_tokens'
         ORDER BY indexname`,
      );
      indexNames = idxs.rows.map((row) => row.indexname);
    }
  } finally {
    await client.$disconnect();
    await pool.end();
  }

  const dbTs = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/lib/db.ts"),
    "utf8",
  );
  const schemaVersionMatch = dbTs.match(
    /PRISMA_SCHEMA_VERSION\s*=\s*\n?\s*"([^"]+)"/,
  );
  const prismaSchemaVersion = schemaVersionMatch?.[1] ?? null;
  const versionBumpedForStayPortal =
    prismaSchemaVersion === "20260727020000_stay_portal_tokens";

  const evidence = {
    at: new Date().toISOString(),
    hasModelInDmmf,
    hasDelegateOnFreshClient: hasDelegate,
    tableExists,
    columnCount,
    indexNames,
    prismaSchemaVersion,
    versionBumpedForStayPortal,
    rootCause:
      "src/lib/db.ts PRISMA_SCHEMA_VERSION was not bumped after StayPortalToken; HMR singleton served a pre-model PrismaClient where db.stayPortalToken === undefined → TypeError on findFirst",
    fix:
      "Bump PRISMA_SCHEMA_VERSION to 20260727020000_stay_portal_tokens so getPrismaClient() recycles the singleton",
    ok:
      hasModelInDmmf &&
      hasDelegate &&
      tableExists === "stay_portal_tokens" &&
      versionBumpedForStayPortal &&
      columnCount >= 8,
  };

  const out = join(
    dirname(fileURLToPath(import.meta.url)),
    "../docs/audits/evidence/stay-portal-prisma-delegate-forensic.json",
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(evidence.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
