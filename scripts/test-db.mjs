import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const [users, properties, active] = await Promise.all([
    db.user.count(),
    db.property.count(),
    db.property.count({ where: { status: "ACTIVE" } }),
  ]);
  console.log("DB OK", { users, properties, activeProperties: active });
} catch (e) {
  console.error("DB FAIL", e);
  process.exit(1);
} finally {
  await db.$disconnect();
  await pool.end();
}
