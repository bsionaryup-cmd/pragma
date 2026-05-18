import { config } from "dotenv";
import { isPublishableKey } from "@clerk/shared/keys";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const sk = process.env.CLERK_SECRET_KEY;
const dbUrl = process.env.DATABASE_URL;

let ok = true;

if (!pk || !isPublishableKey(pk)) {
  console.error("❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY inválida o truncada");
  ok = false;
} else {
  console.log("✓ Clerk publishable key OK");
}

if (!sk?.startsWith("sk_test_") && !sk?.startsWith("sk_live_")) {
  console.error("❌ CLERK_SECRET_KEY inválida");
  ok = false;
} else {
  const res = await fetch("https://api.clerk.com/v1/users?limit=1", {
    headers: { Authorization: `Bearer ${sk}` },
  });
  if (!res.ok) {
    console.error("❌ Clerk secret key rechazada por la API:", res.status);
    ok = false;
  } else {
    console.log("✓ Clerk secret key OK");
  }
}

if (!dbUrl) {
  console.error("❌ DATABASE_URL no definida");
  ok = false;
} else {
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    await pool.query("SELECT 1");
    console.log("✓ PostgreSQL OK");
  } catch (e) {
    console.error("❌ PostgreSQL:", e.message);
    ok = false;
  } finally {
    await pool.end();
  }
}

process.exit(ok ? 0 : 1);
