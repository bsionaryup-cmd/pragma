import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const RES_ID = "cmqzv95v5000204l8qv3kgonl";
const CODE = "HM24S5MKR3";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const reservation = await db.reservation.findUnique({
  where: { id: RES_ID },
  select: {
    id: true,
    guestName: true,
    reservationCode: true,
    checkIn: true,
    checkOut: true,
    totalAmount: true,
    icalUid: true,
  },
});

const audits = await db.emailIngestionAudit.findMany({
  where: {
    organizationId: ORG,
    OR: [
      { subject: { contains: "Diego", mode: "insensitive" } },
      { subject: { contains: "HM24S5MKR3", mode: "insensitive" } },
    ],
  },
  select: {
    id: true,
    subject: true,
    classification: true,
    processingStatus: true,
    reservationId: true,
    parsedPayload: true,
    reservationEvent: {
      select: { id: true, confirmationCode: true, enrichedFields: true },
    },
  },
});

const codeAudits = await db.emailIngestionAudit.findMany({
  where: { organizationId: ORG },
  select: {
    id: true,
    subject: true,
    classification: true,
    processingStatus: true,
    reservationId: true,
    parsedPayload: true,
  },
  take: 2000,
  orderBy: { createdAt: "desc" },
});

const hmAudits = codeAudits.filter((a) => {
  const s = a.parsedPayload?.signals;
  return s?.confirmationCode?.toUpperCase?.() === CODE;
});

console.log(
  JSON.stringify(
    {
      reservation,
      diegoSubjectAudits: audits.map((a) => ({
        id: a.id,
        subject: a.subject,
        classification: a.classification,
        status: a.processingStatus,
        reservationId: a.reservationId,
        code: a.parsedPayload?.signals?.confirmationCode ?? null,
        guest: a.parsedPayload?.signals?.guestName ?? null,
        checkIn: a.parsedPayload?.signals?.checkIn ?? null,
        checkOut: a.parsedPayload?.signals?.checkOut ?? null,
        payout: a.parsedPayload?.signals?.hostPayoutAmount ?? null,
        hasEvent: !!a.reservationEvent,
      })),
      hm24Audits: hmAudits.map((a) => ({
        id: a.id,
        subject: a.subject,
        classification: a.classification,
        status: a.processingStatus,
        reservationId: a.reservationId,
        guest: a.parsedPayload?.signals?.guestName ?? null,
        checkIn: a.parsedPayload?.signals?.checkIn ?? null,
        checkOut: a.parsedPayload?.signals?.checkOut ?? null,
        payout: a.parsedPayload?.signals?.hostPayoutAmount ?? null,
      })),
    },
    null,
    2,
  ),
);

await db.$disconnect();
await pool.end();
