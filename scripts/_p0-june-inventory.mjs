import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const props = await db.property.findMany({
  where: { organizationId: "cmplxfg0a000105jrs0gqtwyc" },
  select: { id: true, unitNumber: true, name: true },
});
console.log("PROPERTIES", JSON.stringify(props, null, 2));

const june = await db.reservation.findMany({
  where: {
    property: { organizationId: "cmplxfg0a000105jrs0gqtwyc" },
    checkIn: { gte: new Date("2026-06-01"), lte: new Date("2026-06-30") },
  },
  select: {
    id: true,
    guestName: true,
    checkIn: true,
    checkOut: true,
    reservationCode: true,
    propertyId: true,
    status: true,
    platform: true,
  },
  orderBy: { checkIn: "asc" },
});
console.log(
  "JUNE",
  JSON.stringify(
    june.map((r) => ({
      ...r,
      checkIn: r.checkIn.toISOString().slice(0, 10),
      checkOut: r.checkOut.toISOString().slice(0, 10),
    })),
    null,
    2,
  ),
);

await db.$disconnect();
await pool.end();
