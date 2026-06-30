import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const placeholders = await db.reservation.findMany({
  where: { id: { in: ["cmqzv95v5000204l8qv3kgonl", "cmqzv96n4000604l8dbkm7u4y"] } },
  select: {
    id: true,
    guestName: true,
    checkIn: true,
    checkOut: true,
    icalUid: true,
    property: { select: { unitNumber: true } },
  },
});

const karla = await db.reservation.findFirst({
  where: { reservationCode: "HM4SPXSTS2" },
  select: { checkIn: true, checkOut: true, guestName: true, icalUid: true, internalNotes: true },
});

console.log(JSON.stringify({ placeholders, karla }, null, 2));

await db.$disconnect();
await pool.end();
