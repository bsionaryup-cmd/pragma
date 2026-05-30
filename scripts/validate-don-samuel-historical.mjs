/**
 * Validación post-backfill Don Samuel.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PaymentStatus, PrismaClient, ReservationStatus } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const orgId = "cmplxfg0a000105jrs0gqtwyc";
const cutoff = "2026-05-25";
const HISTORICAL_PREFIX = "pragma-historical:";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function toKey(date) {
  return date.toISOString().slice(0, 10);
}

function activeIcalFilter() {
  return {
    OR: [
      { icalUrl: { startsWith: "https://" } },
      { icalUrl: { startsWith: "http://" } },
      { icalUrl: { startsWith: "webcal://" } },
    ],
  };
}

function withVisible(where) {
  return {
    AND: [
      where,
      {
        OR: [
          { property: activeIcalFilter() },
          { AND: [{ icalUid: null }, { platform: { not: "AIRBNB" } }] },
        ],
      },
    ],
  };
}

async function main() {
  const accountingStatuses = [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
    ReservationStatus.CHECKOUT_TODAY,
    ReservationStatus.CHECKED_OUT,
  ];

  const historical = await db.reservation.findMany({
    where: {
      property: { organizationId: orgId },
      icalUid: { startsWith: HISTORICAL_PREFIX },
    },
    orderBy: { checkIn: "asc" },
  });

  const visibleCount = await db.reservation.count({
    where: withVisible({
      property: { organizationId: orgId },
      icalUid: { startsWith: HISTORICAL_PREFIX },
    }),
  });

  const april = historical.filter((r) => toKey(r.checkIn).startsWith("2026-04"));
  const may = historical.filter(
    (r) => toKey(r.checkIn).startsWith("2026-05") && toKey(r.checkIn) < cutoff,
  );

  const financeRevenue = historical
    .filter(
      (r) =>
        accountingStatuses.includes(r.status) &&
        r.paymentStatus === PaymentStatus.PAID,
    )
    .reduce((sum, r) => sum + Number(r.totalAmount), 0);

  const pilot = await db.reservation.findMany({
    where: {
      property: { organizationId: orgId },
      checkIn: { gte: new Date(`${cutoff}T00:00:00.000Z`) },
      NOT: { icalUid: { startsWith: HISTORICAL_PREFIX } },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      property: { select: { unitNumber: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const overlaps = await db.$queryRaw`
    SELECT a."reservationCode" AS code_a, b."reservationCode" AS code_b,
           a."checkIn" AS a_in, a."checkOut" AS a_out,
           b."checkIn" AS b_in, b."checkOut" AS b_out,
           p."unitNumber" AS unit
    FROM reservations a
    JOIN reservations b ON a."propertyId" = b."propertyId" AND a.id < b.id
    JOIN properties p ON p.id = a."propertyId"
    WHERE p."organizationId" = ${orgId}
      AND a.status NOT IN ('CANCELLED', 'BLOCKED')
      AND b.status NOT IN ('CANCELLED', 'BLOCKED')
      AND a."checkIn" < b."checkOut"
      AND b."checkIn" < a."checkOut"
    ORDER BY a."checkIn"
  `;

  const totalReservations = await db.reservation.count({
    where: { property: { organizationId: orgId } },
  });

  console.log("\n════════════════ VALIDACIÓN POST-BACKFILL ════════════════");
  console.log(`Total reservas org:           ${totalReservations} (16 hist + 6 piloto)`);
  console.log(`Históricas importadas:        ${historical.length}`);
  console.log(`Visibles en calendario/UI:    ${visibleCount}`);
  console.log(`Abril 2026:                   ${april.length}`);
  console.log(`Mayo (check-in < 25):         ${may.length}`);
  console.log(`Ingresos finanzas (PAID):     ${financeRevenue.toFixed(2)} COP`);
  console.log(`Reservas piloto (>= cutoff):  ${pilot.length}`);
  console.log(`Solapamientos detectados:     ${Array.isArray(overlaps) ? overlaps.length : 0}`);

  if (Array.isArray(overlaps) && overlaps.length > 0) {
    for (const row of overlaps) {
      console.log(`  ⚠ ${row.unit}: ${row.code_a ?? "?"} ↔ ${row.code_b ?? "?"}`);
    }
  }

  console.log("\n── Piloto (no tocado) ──");
  for (const r of pilot) {
    console.log(
      `  ${r.property.unitNumber} · ${toKey(r.checkIn)}→${toKey(r.checkOut)} · ${r.guestName} · ${r.status}`,
    );
  }

  const checks = [
    ["16 históricas", historical.length === 16],
    ["6 abril", april.length === 6],
    ["10 mayo", may.length === 10],
    ["Ingresos $5.477.179", Math.abs(financeRevenue - 5477179.03) < 0.01],
    ["16 visibles UI", visibleCount === 16],
    ["6 piloto intactas", pilot.length === 6],
    ["Sin solapamientos", !Array.isArray(overlaps) || overlaps.length === 0],
  ];

  console.log("\n── Checklist ──");
  let allOk = true;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (!ok) allOk = false;
  }
  console.log(`\n${allOk ? "RESULTADO: OK" : "RESULTADO: REVISAR"}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
