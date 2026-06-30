/**
 * Dedupe recoverable reservation gaps from email audits.
 * node scripts/_p0-recoverable-gaps.mjs
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

function readAmount(payload, field) {
  const raw = readSignal(payload, field);
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
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
      property: { select: { unitNumber: true } },
    },
  });

  const byCode = new Map();
  for (const r of reservations) {
    if (r.reservationCode) byCode.set(r.reservationCode.toUpperCase(), r);
  }

  const audits = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: ORG,
      processingStatus: "PROCESSED",
      classification: { in: ["CONFIRMED", "UPDATED"] },
    },
    select: {
      id: true,
      subject: true,
      classification: true,
      parsedPayload: true,
      propertyId: true,
      reservationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const bestByCode = new Map();

  for (const audit of audits) {
    const code = readSignal(audit.parsedPayload, "confirmationCode");
    if (!code) continue;
    const upper = code.toUpperCase();
    if (byCode.has(upper)) continue;

    const guest = readSignal(audit.parsedPayload, "guestName");
    const checkIn = readSignal(audit.parsedPayload, "checkIn");
    const checkOut = readSignal(audit.parsedPayload, "checkOut");
    if (!guest || !checkIn || !checkOut) continue;
    if (guest.length > 80 || /ha pagado|sabe cómo/i.test(guest)) continue;

    const hostPayout =
      readAmount(audit.parsedPayload, "hostPayoutAmount") ??
      readAmount(audit.parsedPayload, "netPayout");

    const existing = bestByCode.get(upper);
    if (!existing || audit.createdAt > existing.createdAt) {
      bestByCode.set(upper, {
        code: upper,
        guest,
        checkIn,
        checkOut,
        propertyId: audit.propertyId,
        hostPayout,
        classification: audit.classification,
        auditId: audit.id,
        subject: audit.subject?.slice(0, 100),
        createdAt: audit.createdAt.toISOString(),
      });
    }
  }

  const gaps = [...bestByCode.values()].sort((a, b) =>
    a.checkIn.localeCompare(b.checkIn),
  );

  // Check date overlaps with existing reservations
  for (const gap of gaps) {
    const overlaps = reservations.filter(
      (r) =>
        r.checkIn.toISOString().slice(0, 10) < gap.checkOut &&
        gap.checkIn < r.checkOut.toISOString().slice(0, 10),
    );
    gap.overlapsExisting = overlaps.map((r) => ({
      id: r.id,
      guest: r.guestName,
      unit: r.property.unitNumber,
      checkIn: r.checkIn.toISOString().slice(0, 10),
      checkOut: r.checkOut.toISOString().slice(0, 10),
      code: r.reservationCode,
    }));
  }

  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        recoverableUniqueCodes: gaps.length,
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
