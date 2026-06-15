import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const audits = await db.emailIngestionAudit.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      reservationId: true,
      classification: true,
      processingStatus: true,
      matchMethod: true,
      matchConfidence: true,
      createdAt: true,
      organization: { select: { name: true } },
      property: { select: { name: true } },
    },
  });

  const orgs = await db.organization.findMany({
    where: { name: { contains: "URBA", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      airbnbEmailIntegration: {
        select: {
          enabled: true,
          inboundEmailAddress: true,
          lastEmailReceivedAt: true,
          lastProcessedAt: true,
          syncStatus: true,
        },
      },
      _count: { select: { airbnbListingEmailMaps: true } },
    },
  });

  console.log(JSON.stringify({ audits, orgs }, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
