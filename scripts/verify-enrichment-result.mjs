import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const rows = await db.reservation.findMany({
    where: {
      id: {
        in: [
          "cmpm0xawm000304jgd2k8vui7",
          "cmpnc1v7e000004juw7z33cz8",
          "cmqegpzso000004if34la52oo",
          "cmqegpzue000204iffd78tkxk",
          "cmqegpzvl000404ifzh990xtf",
        ],
      },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      emailEvents: {
        select: { eventKind: true, enrichedFields: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
