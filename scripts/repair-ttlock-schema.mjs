/**
 * Repara columnas TTLock faltantes sin borrar datos (idempotente).
 * Uso: npm run db:repair:ttlock
 */
import { execSync } from "node:child_process";
import pg from "pg";
import { config } from "dotenv";

const root = process.cwd();
config({ path: ".env" });
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL no configurada");
  process.exit(1);
}

const repairSql = `
DO $$ BEGIN
  CREATE TYPE "TTLockEnvironment" AS ENUM ('PRODUCTION', 'SANDBOX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TTLockIntegrationStatus" ADD VALUE IF NOT EXISTS 'CONNECTING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TTLockIntegrationStatus" ADD VALUE IF NOT EXISTS 'INVALID_CREDENTIALS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ttlock_integrations"
  ADD COLUMN IF NOT EXISTS "environment" "TTLockEnvironment" NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE "ttlock_integrations"
  ADD COLUMN IF NOT EXISTS "redirectUri" TEXT;

ALTER TABLE "ttlock_integrations"
  ADD COLUMN IF NOT EXISTS "lastError" TEXT;
`;

async function runRepair() {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    console.log("→ Reparando columnas TTLock (idempotente)...");
    await pool.query(repairSql);
    console.log("✓ Columnas TTLock verificadas");
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("→ Aplicando migraciones pendientes...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit", cwd: root });
  } catch {
    console.warn("migrate deploy falló; intentando reparación SQL directa...");
    await runRepair();
  }

  execSync("npx prisma generate", { stdio: "inherit", cwd: root });
  console.log("✓ TTLock schema repair completado. Reinicia npm run dev.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
