/**
 * Importa el lote aprobado de 16 reservas históricas Don Samuel.
 * Idempotente · no toca reservas con check-in >= cutoff.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BookingPlatform,
  PrismaClient,
  ReservationStatus,
  PaymentStatus,
} from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const HISTORICAL_PREFIX = "pragma-historical:";
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const payload = JSON.parse(
  readFileSync(new URL("../data/don-samuel-historical-approved.json", import.meta.url), "utf8"),
);

function dateOnlyFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function prismaDateToKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildIcalUid(code) {
  return `${HISTORICAL_PREFIX}${code.trim().toUpperCase()}`;
}

async function main() {
  const { organizationId, cutoff, reservations } = payload;

  const pilotBefore = await db.reservation.findMany({
    where: {
      property: { organizationId },
      checkIn: { gte: dateOnlyFromKey(cutoff) },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      totalAmount: true,
      reservationCode: true,
      property: { select: { unitNumber: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  console.log(`\nImport histórico Don Samuel · ${dryRun ? "DRY-RUN" : "ESCRITURA"}`);
  console.log(`Cutoff: check-in < ${cutoff}`);
  console.log(`Reservas piloto protegidas (>= cutoff): ${pilotBefore.length}\n`);

  let created = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const row of reservations) {
    if (row.checkIn >= cutoff) {
      console.log(`SKIP fuera de scope: ${row.code}`);
      skipped += 1;
      continue;
    }

    const icalUid = buildIcalUid(row.code);
    const existing = await db.reservation.findFirst({
      where: {
        propertyId: row.propertyId,
        OR: [{ icalUid }, { reservationCode: row.code.toUpperCase() }],
      },
      select: { id: true, icalUid: true },
    });

    if (existing) {
      console.log(`SKIP duplicado: ${row.code}`);
      duplicates += 1;
      continue;
    }

    const data = {
      propertyId: row.propertyId,
      guestName: row.guestName,
      guestFirstName: row.guestName.split(/\s+/)[0] || "Huésped",
      guestLastName: row.guestName.split(/\s+/).slice(1).join(" ") || null,
      checkIn: dateOnlyFromKey(row.checkIn),
      checkOut: dateOnlyFromKey(row.checkOut),
      platform: BookingPlatform.AIRBNB,
      status: ReservationStatus.CHECKED_OUT,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: row.totalAmount,
      currency: "COP",
      reservationCode: row.code.toUpperCase(),
      icalUid,
      adults: 1,
      children: 0,
      infants: 0,
      internalNotes: `Backfill histórico aprobado Don Samuel · ${row.checkIn}`,
    };

    if (dryRun) {
      console.log(`CREATE ${row.code} · ${row.checkIn}→${row.checkOut} · ${row.guestName} · ${row.totalAmount}`);
      created += 1;
      continue;
    }

    await db.reservation.create({ data });
    console.log(`OK ${row.code} · ${row.checkIn}→${row.checkOut}`);
    created += 1;
  }

  const historical = await db.reservation.findMany({
    where: {
      property: { organizationId },
      icalUid: { startsWith: HISTORICAL_PREFIX },
    },
    select: {
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      totalAmount: true,
      guestName: true,
      property: { select: { unitNumber: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const pilotAfter = await db.reservation.findMany({
    where: {
      property: { organizationId },
      checkIn: { gte: dateOnlyFromKey(cutoff) },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      totalAmount: true,
      property: { select: { unitNumber: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const revenue = historical.reduce((sum, r) => sum + Number(r.totalAmount), 0);
  const april = historical.filter((r) => prismaDateToKey(r.checkIn).startsWith("2026-04"));
  const may = historical.filter((r) => {
    const key = prismaDateToKey(r.checkIn);
    return key.startsWith("2026-05") && key < cutoff;
  });

  console.log("\n--- Resumen import ---");
  console.log(`Creadas:     ${created}`);
  console.log(`Duplicados:  ${duplicates}`);
  console.log(`Omitidas:    ${skipped}`);

  console.log("\n--- Validación ---");
  console.log(`Históricas en DB:  ${historical.length} (esperado: 16)`);
  console.log(`Abril 2026:        ${april.length} (esperado: 6)`);
  console.log(`Mayo hasta 24:     ${may.length} (esperado: 10)`);
  console.log(`Ingresos históricos: ${revenue.toFixed(2)} COP (esperado: 5477179.03)`);
  console.log(`Reservas piloto:   ${pilotAfter.length} (esperado: 6, sin cambios)`);

  const pilotUnchanged =
    pilotBefore.length === pilotAfter.length &&
    pilotBefore.every((before, i) => {
      const after = pilotAfter[i];
      return (
        before.id === after.id &&
        before.guestName === after.guestName &&
        prismaDateToKey(before.checkIn) === prismaDateToKey(after.checkIn) &&
        prismaDateToKey(before.checkOut) === prismaDateToKey(after.checkOut) &&
        before.status === after.status
      );
    });

  console.log(`Piloto intacto:    ${pilotUnchanged ? "SÍ" : "NO — REVISAR"}`);

  if (!pilotUnchanged) {
    console.log("\nAntes:", JSON.stringify(pilotBefore, null, 2));
    console.log("\nDespués:", JSON.stringify(pilotAfter, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
