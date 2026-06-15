import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const PROP = "cmpmqijw0000204jv24dur0i7";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const counts = await db.emailIngestionAudit.groupBy({
    by: ["classification"],
    where: { organizationId: ORG },
    _count: true,
  });

  const unlinkedConfirmed = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: ORG,
      classification: "CONFIRMED",
      reservationId: null,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      propertyId: true,
      createdAt: true,
      matchMethod: true,
      parsedPayload: true,
    },
  });

  const propConfirmed = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: ORG,
      propertyId: PROP,
      classification: { in: ["CONFIRMED", "UPDATED", "CHECKIN_REMINDER", "EXTENDED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      classification: true,
      reservationId: true,
      createdAt: true,
      matchMethod: true,
      parsedPayload: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        counts,
        unlinkedConfirmed: unlinkedConfirmed.map((a) => ({
          id: a.id,
          propertyId: a.propertyId,
          createdAt: a.createdAt.toISOString(),
          matchMethod: a.matchMethod,
          guestName:
            a.parsedPayload &&
            typeof a.parsedPayload === "object" &&
            !Array.isArray(a.parsedPayload)
              ? a.parsedPayload.signals?.guestName
              : null,
          checkIn:
            a.parsedPayload &&
            typeof a.parsedPayload === "object" &&
            !Array.isArray(a.parsedPayload)
              ? a.parsedPayload.signals?.checkIn
              : null,
        })),
        propEnrichableEvents: propConfirmed.map((a) => ({
          id: a.id,
          classification: a.classification,
          reservationId: a.reservationId,
          createdAt: a.createdAt.toISOString(),
          guestName:
            a.parsedPayload &&
            typeof a.parsedPayload === "object" &&
            !Array.isArray(a.parsedPayload)
              ? a.parsedPayload.signals?.guestName
              : null,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
