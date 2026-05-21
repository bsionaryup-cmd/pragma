/**
 * Repara columnas de users (locale, theme, timezone) y tablas relacionadas.
 * Idempotente — no borra datos.
 * Uso: npm run db:repair:user
 */
import { execSync } from "node:child_process";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL no configurada");
  process.exit(1);
}

const repairSql = `
DO $$ BEGIN
  CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'RECEPTIONIST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'OPERATIONS'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (
      CASE
        WHEN "role"::text = 'OPERATIONS' THEN 'RECEPTIONIST'::"UserRole_new"
        WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole_new"
        ELSE 'RECEPTIONIST'::"UserRole_new"
      END
    );
    DROP TYPE "UserRole";
    ALTER TYPE "UserRole_new" RENAME TO "UserRole";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'RECEPTIONIST';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Bogota';

DO $$ BEGIN
  CREATE TYPE "LoginActivityStatus" AS ENUM ('SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "login_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "status" "LoginActivityStatus" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "login_activities_userId_createdAt_idx"
  ON "login_activities"("userId", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "login_activities"
    ADD CONSTRAINT "login_activities_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

async function runRepair() {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    console.log("→ Reparando users.locale / theme / timezone...");
    await pool.query(repairSql);
    console.log("✓ Columnas de usuario verificadas");
  } finally {
    await pool.end();
  }

  console.log("→ prisma generate...");
  execSync("npx prisma generate", { stdio: "inherit", cwd: process.cwd() });
  console.log("✓ Listo. Reinicia npm run dev si estaba activo.");
}

runRepair().catch((err) => {
  console.error(err);
  process.exit(1);
});
