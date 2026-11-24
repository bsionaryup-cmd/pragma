import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

async function main() {
  const rid = "cms6fztsq000004l3n664gyiw";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const legal = await db.guestRegistrationLegalAcceptance.findUnique({
      where: { reservationId: rid },
    });
    const tokens = await db.guestRegistrationToken.findMany({
      where: { reservationId: rid },
      select: {
        id: true,
        status: true,
        usedAt: true,
        createdAt: true,
      },
    });
    const guests = await db.reservationGuest.findMany({
      where: { reservationId: rid },
      select: {
        fullName: true,
        isPrimary: true,
        isReservationOwner: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    console.log(JSON.stringify({ legal, tokens, guests }, null, 2));
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
