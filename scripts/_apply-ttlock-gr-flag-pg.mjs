import { config } from "dotenv";
config({ path: ".env.local", override: true });
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  ALTER TABLE "ttlock_automation_settings"
    ALTER COLUMN "generateAfterGuestRegistration" SET DEFAULT true
`);

const updated = await client.query(`
  UPDATE "ttlock_automation_settings"
  SET "generateAfterGuestRegistration" = true
  WHERE "generateAfterGuestRegistration" = false
`);

const check = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "generateAfterGuestRegistration" = true)::int AS enabled,
    COUNT(*) FILTER (WHERE "generateAfterGuestRegistration" = false)::int AS disabled
  FROM "ttlock_automation_settings"
`);

console.log(
  JSON.stringify({
    rowsUpdated: updated.rowCount,
    stats: check.rows[0],
  }),
);

await client.end();
