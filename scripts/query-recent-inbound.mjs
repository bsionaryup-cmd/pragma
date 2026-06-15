import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const since = new Date("2026-05-31T17:17:26.358Z");

const integration = await db.tenantAirbnbEmailIntegration.findUnique({
  where: { organizationId: ORG },
});

const audits = await db.emailIngestionAudit.findMany({
  where: { organizationId: ORG, createdAt: { gte: since } },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    createdAt: true,
    processedAt: true,
    fromAddress: true,
    subject: true,
    classification: true,
    processingStatus: true,
    reservationId: true,
    errorReason: true,
    reservationEvent: {
      select: { eventKind: true, enrichedFields: true, confirmationCode: true },
    },
  },
});

const miguel = await db.reservation.findUnique({
  where: { id: "cmqegpzvl000404ifzh990xtf" },
  select: {
    guestName: true,
    reservationCode: true,
    totalAmount: true,
    emailEvents: {
      orderBy: { createdAt: "desc" },
      select: {
        eventKind: true,
        createdAt: true,
        enrichedFields: true,
        audit: { select: { subject: true, createdAt: true, fromAddress: true } },
      },
    },
  },
});

console.log(
  JSON.stringify(
    {
      integration: {
        lastEmailReceivedAt: integration?.lastEmailReceivedAt,
        lastProcessedAt: integration?.lastProcessedAt,
        lastError: integration?.lastError,
      },
      auditsSinceMay31: audits,
      miguelReservation: miguel,
      gapNote:
        integration?.lastEmailReceivedAt &&
        audits[0] &&
        integration.lastEmailReceivedAt > audits[0].createdAt
          ? "lastEmailReceivedAt is NEWER than latest audit — email hit Resend/webhook but may not have created audit"
          : null,
    },
    null,
    2,
  ),
);

await db.$disconnect();
await pool.end();
