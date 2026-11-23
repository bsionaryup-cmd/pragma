/**
 * Aborts if DATABASE_URL points at the known shared operational Neon host.
 * Usage: node scripts/staging/assert-staging-db.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";

const OPERATIONAL_HOST_FRAGMENT = "ep-purple-block-apuk7v1k";

config({ path: resolve(process.cwd(), ".env.staging"), override: true });

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("❌ DATABASE_URL ausente. Crea .env.staging desde .env.staging.example");
  process.exit(1);
}

let host = "";
try {
  host = new URL(url).host;
} catch {
  console.error("❌ DATABASE_URL inválida");
  process.exit(1);
}

if (host.includes(OPERATIONAL_HOST_FRAGMENT)) {
  console.error("❌ REFUSED: DATABASE_URL apunta a Neon operativa compartida.");
  console.error(`   host=${host}`);
  console.error("   Usa un branch Neon staging independiente.");
  process.exit(2);
}

if (process.env.PRAGMA_WEB_BUILDER_STAGING !== "1") {
  console.error("❌ PRAGMA_WEB_BUILDER_STAGING debe ser 1 en .env.staging");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      host,
      database: new URL(url).pathname.replace(/^\//, "") || null,
      stagingFlag: process.env.PRAGMA_WEB_BUILDER_STAGING,
      appUrl: process.env.APP_URL || null,
      port: process.env.PORT || null,
    },
    null,
    2,
  ),
);
