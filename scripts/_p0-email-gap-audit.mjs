/**
 * Find email audit records with reservation signals but no matching DB row.
 * node scripts/_p0-email-gap-audit.mjs
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readSignal(payload, field) {
  if (!payload || typeof payload !== "object") return null;
  const signals = payload.signals;
  if (!signals || typeof signals !== "object") return null;
  const v = signals[field];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toDate(key) {
  if (!key) return null;
  const d = new Date(`${key}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const reservations = await db.reservation.findMany({
    where: { property: { organizationId: ORG } },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      reservationCode: true,
      icalUid: true,
      propertyId: true,
    },
  });

  const byCode = new Map();
  for (const r of reservations) {
    if (r.reservationCode) byCode.set(r.reservationCode.toUpperCase(), r);
  }

  const audits = await db.emailIngestionAudit.findMany({
    where: { organizationId: ORG },
    select: {
      id: true,
      subject: true,
      classification: true,
      processingStatus: true,
      reservationId: true,
      parsedPayload: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const gaps = [];
  const matched = [];

  for (const audit of audits) {
    const code =
      readSignal(audit.parsedPayload, "confirmationCode") ??
      readSignal(audit.parsedPayload, "reservationCode");
    const guest = readSignal(audit.parsedPayload, "guestName");
    const checkIn = readSignal(audit.parsedPayload, "checkIn");
    const checkOut = readSignal(audit.parsedPayload, "checkOut");

    if (!code && !guest) continue;

    const codeUpper = code?.toUpperCase() ?? null;
    const dbMatch = codeUpper ? byCode.get(codeUpper) : null;
    const linkedOk =
      audit.reservationId &&
      reservations.some((r) => r.id === audit.reservationId);

    if (codeUpper && !dbMatch && !linkedOk) {
      gaps.push({
        type: "CODE_NO_RESERVATION",
        auditId: audit.id,
        code: codeUpper,
        guest,
        checkIn,
        checkOut,
        classification: audit.classification,
        status: audit.processingStatus,
        subject: audit.subject?.slice(0, 80),
        createdAt: audit.createdAt.toISOString(),
      });
    } else if (codeUpper && dbMatch) {
      matched.push({ code: codeUpper, reservationId: dbMatch.id });
    } else if (linkedOk) {
      matched.push({ auditId: audit.id, reservationId: audit.reservationId });
    } else if (guest && checkIn && checkOut) {
      const ci = toDate(checkIn);
      const co = toDate(checkOut);
      const dateMatch = reservations.find(
        (r) =>
          r.guestName?.toLowerCase().includes(guest.split(" ")[0]?.toLowerCase() ?? "") &&
          r.checkIn.toISOString().slice(0, 10) === checkIn &&
          r.checkOut.toISOString().slice(0, 10) === checkOut,
      );
      if (!dateMatch) {
        gaps.push({
          type: "DATES_GUEST_NO_MATCH",
          auditId: audit.id,
          guest,
          checkIn,
          checkOut,
          classification: audit.classification,
          status: audit.processingStatus,
          subject: audit.subject?.slice(0, 80),
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        totalAudits: audits.length,
        matchedSignals: matched.length,
        recoverableGaps: gaps.length,
        gaps,
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
