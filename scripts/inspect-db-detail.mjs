import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      organizationId: true,
      role: true,
      isAccountOwner: true,
      platformRole: true,
      deletedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
      organizationId: true,
      status: true,
      createdAt: true,
    },
  });

  const orphanOrgs = await db.organization.findMany({
    where: {
      users: { none: { deletedAt: null } },
      properties: { none: {} },
    },
    select: { id: true, name: true, createdAt: true },
  });

  console.log(JSON.stringify({ users, properties, orphanOrgCount: orphanOrgs.length, orphanOrgs }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
