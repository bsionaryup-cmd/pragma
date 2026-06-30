/**
 * Restore trusted enrichment for 802 Jun 27–30 placeholder from CONFIRMED email audit.
 * node scripts/restore-diego-enrichment.mjs [--dry-run]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const AUDIT_ID = "cmqv91v8z000304ify41wxj02";
const RESERVATION_ID = "cmqzv95v5000204l8qv3kgonl";
const CODE = "HM24S5MKR3";
const GUEST = "Diego Fernando Carrillo García";
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function splitGuestName(fullName) {
  const guestName = fullName.trim().replace(/\s+/g, " ");
  const parts = guestName.split(/\s+/);
  return {
    guestName,
    guestFirstName: parts[0] ?? guestName,
    guestLastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

const audit = await db.emailIngestionAudit.findUnique({
  where: { id: AUDIT_ID },
  select: {
    id: true,
    classification: true,
    reservationId: true,
    parsedPayload: true,
    reservationEvent: {
      select: { id: true, reservationId: true, enrichedFields: true, confirmationCode: true },
    },
  },
});

if (!audit) throw new Error(`Audit ${AUDIT_ID} not found`);
if (audit.classification !== "CONFIRMED") {
  throw new Error(`Audit classification is ${audit.classification}, expected CONFIRMED`);
}

const reservation = await db.reservation.findUnique({
  where: { id: RESERVATION_ID },
  select: {
    id: true,
    guestName: true,
    reservationCode: true,
    checkIn: true,
    checkOut: true,
    totalAmount: true,
  },
});

if (!reservation) throw new Error(`Reservation ${RESERVATION_ID} not found`);

const split = splitGuestName(GUEST);
const signals =
  audit.parsedPayload &&
  typeof audit.parsedPayload === "object" &&
  !Array.isArray(audit.parsedPayload)
    ? audit.parsedPayload.signals ?? audit.parsedPayload
    : null;

const hostPayout =
  (audit.reservationEvent?.enrichedFields &&
    typeof audit.reservationEvent.enrichedFields === "object" &&
    typeof audit.reservationEvent.enrichedFields.hostPayoutAmount === "number" &&
    audit.reservationEvent.enrichedFields.hostPayoutAmount) ||
  signals?.hostPayoutAmount ||
  signals?.netPayout ||
  null;

const update = {
  guestName: split.guestName,
  guestFirstName: split.guestFirstName,
  guestLastName: split.guestLastName,
  reservationCode: CODE,
  internalNotes: `Enriquecido performance audit · audit ${AUDIT_ID}`,
  ...(hostPayout != null && hostPayout > 0 && Number(reservation.totalAmount ?? 0) === 0
    ? { totalAmount: hostPayout, paymentStatus: "PAID" }
    : {}),
};

const result = { dryRun, before: reservation, update, auditLinked: audit.reservationId };

if (!dryRun) {
  await db.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id: RESERVATION_ID }, data: update });
    await tx.emailIngestionAudit.update({
      where: { id: AUDIT_ID },
      data: { reservationId: RESERVATION_ID, processingStatus: "PROCESSED" },
    });
    if (audit.reservationEvent?.id) {
      await tx.reservationEmailEvent.update({
        where: { id: audit.reservationEvent.id },
        data: {
          reservationId: RESERVATION_ID,
          confirmationCode: CODE,
        },
      });
    }
  });
  result.after = await db.reservation.findUnique({
    where: { id: RESERVATION_ID },
    select: { guestName: true, reservationCode: true, totalAmount: true, paymentStatus: true },
  });
}

console.log(JSON.stringify(result, null, 2));

await db.$disconnect();
await pool.end();
