import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const miguelAuditId = "cmqem616w000004jmapjhyqt3";
const miguelReservationId = "cmqegpzvl000404ifzh990xtf";

const audit = await db.emailIngestionAudit.findUnique({
  where: { id: miguelAuditId },
  select: {
    id: true,
    classification: true,
    subject: true,
    reservationId: true,
    reservationEvent: {
      select: {
        eventKind: true,
        confirmationCode: true,
        enrichedFields: true,
      },
    },
  },
});

const reservation = await db.reservation.findUnique({
  where: { id: miguelReservationId },
  select: {
    guestName: true,
    guestFirstName: true,
    guestLastName: true,
    reservationCode: true,
    totalAmount: true,
    currency: true,
    emailEvents: {
      orderBy: { createdAt: "desc" },
      select: {
        eventKind: true,
        confirmationCode: true,
        enrichedFields: true,
        createdAt: true,
      },
    },
  },
});

console.log(JSON.stringify({ audit, reservation }, null, 2));

await db.$disconnect();
await pool.end();
