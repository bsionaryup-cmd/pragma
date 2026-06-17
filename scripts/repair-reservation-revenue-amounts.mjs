/**
 * Corrige totalAmount desactualizado usando el payout del anfitrión del email UPDATED.
 * Usage: node scripts/repair-reservation-revenue-amounts.mjs [--dry-run]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = process.env.AUDIT_ORG_ID ?? "cmplxfg0a000105jrs0gqtwyc";
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function num(v) {
  return Number(v?.toString?.() ?? v);
}

function hostPayoutFromEvent(event) {
  const sig = event.payload?.signals ?? {};
  const en = event.enrichedFields ?? {};
  for (const key of ["hostPayoutAmount", "netPayout"]) {
    const value = num(en[key] ?? sig[key]);
    if (value > 0) return value;
  }
  return null;
}

async function main() {
  const reservations = await db.reservation.findMany({
    where: {
      property: { organizationId: ORG_ID },
      platform: "AIRBNB",
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      guestName: true,
      totalAmount: true,
      checkIn: true,
      reservationCode: true,
    },
  });

  let repaired = 0;
  for (const row of reservations) {
    const events = await db.reservationEmailEvent.findMany({
      where: { reservationId: row.id },
      select: {
        eventKind: true,
        enrichedFields: true,
        payload: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const priority = { UPDATED: 4, EXTENDED: 3, CHECKIN_REMINDER: 2, CONFIRMED: 1 };
    const eligible = events
      .filter((e) => priority[e.eventKind] != null)
      .sort(
        (a, b) =>
          (priority[b.eventKind] ?? 0) - (priority[a.eventKind] ?? 0),
      );

    let authoritative = null;
    for (const event of eligible) {
      authoritative = hostPayoutFromEvent(event);
      if (authoritative != null) break;
    }
    if (authoritative == null) continue;

    const stored = num(row.totalAmount);
    if (Math.abs(stored - authoritative) < 1) continue;
    if (!(authoritative > stored * 1.05 || stored < authoritative * 0.5)) continue;

    console.log("repair", {
      id: row.id,
      guest: row.guestName,
      checkIn: row.checkIn.toISOString().slice(0, 10),
      stored,
      authoritative,
    });

    if (!dryRun) {
      await db.reservation.update({
        where: { id: row.id },
        data: { totalAmount: authoritative },
      });
    }
    repaired += 1;
  }

  console.log(`done: ${repaired} reservation(s) ${dryRun ? "would be " : ""}repaired`);
}

main().finally(async () => {
  await db.$disconnect();
  await pool.end();
});
