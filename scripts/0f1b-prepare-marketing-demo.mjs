/**
 * 0F-1b — Prepare demo tenant with marketing-safe synthetic data only.
 * Touches ONLY organization "PRAGMA Demo · Urbano Loft". Never pilot / client orgs.
 *
 * Usage: node scripts/0f1b-prepare-marketing-demo.mjs
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ReservationStatus } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const DEMO_ORG_NAME = "PRAGMA Demo · Urbano Loft";
const PILOT_ORG_ID = "cmplxfg0a000105jrs0gqtwyc";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function dateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function todayUtcDate() {
  const now = new Date();
  return dateOnly(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

function roundAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "980000";
  const rounded = Math.round(n / 10000) * 10000;
  return String(rounded);
}

const SYNTHETIC = {
  maria: {
    guestName: "María Torres",
    guestFirstName: "María",
    guestLastName: "Torres",
    guestEmail: "maria.torres@example.com",
    guestPhone: null,
    reservationCode: "DEMO-MT-01",
    totalAmount: "980000",
  },
  juan: {
    guestName: "Juan Pérez",
    guestFirstName: "Juan",
    guestLastName: "Pérez",
    guestEmail: "juan.perez@example.com",
    guestPhone: null,
    reservationCode: "DEMO-JP-02",
    totalAmount: "1150000",
  },
  laura: {
    guestName: "Laura Gómez",
    guestFirstName: "Laura",
    guestLastName: "Gómez",
    guestEmail: "laura.gomez@example.com",
    guestPhone: null,
    reservationCode: "DEMO-LG-03",
    totalAmount: "870000",
  },
  camila: {
    guestName: "Camila Rojas",
    guestFirstName: "Camila",
    guestLastName: "Rojas",
    guestEmail: "camila.rojas@example.com",
    guestPhone: null,
    reservationCode: "DEMO-CR-04",
    totalAmount: "1420000",
  },
  andres: {
    guestName: "Andrés Mejía",
    guestFirstName: "Andrés",
    guestLastName: "Mejía",
    guestEmail: "andres.mejia@example.com",
    guestPhone: null,
    reservationCode: "DEMO-AM-05",
    totalAmount: "1280000",
  },
  pedro: {
    guestName: "Pedro Ramírez",
    guestFirstName: "Pedro",
    guestLastName: "Ramírez",
    guestEmail: "pedro.ramirez@example.com",
    guestPhone: null,
    reservationCode: "DEMO-PR-06",
    totalAmount: "760000",
  },
  ana: {
    guestName: "Ana Villalobos",
    guestFirstName: "Ana",
    guestLastName: "Villalobos",
    guestEmail: "ana.villalobos@example.com",
    guestPhone: null,
    reservationCode: "DEMO-AV-07",
    totalAmount: "1560000",
  },
};

function guestPatch(profile) {
  return {
    guestName: profile.guestName,
    guestFirstName: profile.guestFirstName,
    guestLastName: profile.guestLastName,
    guestEmail: profile.guestEmail,
    guestPhone: profile.guestPhone,
    reservationCode: profile.reservationCode,
    totalAmount: profile.totalAmount,
    internalNotes: "Reserva demo · datos sintéticos para marketing.",
  };
}

async function assertPilotUntouched(beforeCounts) {
  const after = await db.reservation.count({
    where: { property: { organizationId: PILOT_ORG_ID } },
  });
  if (after !== beforeCounts.pilotReservations) {
    throw new Error(
      `Pilot org reservation count changed (${beforeCounts.pilotReservations} → ${after}). Abort.`,
    );
  }
}

async function main() {
  const pilotReservations = await db.reservation.count({
    where: { property: { organizationId: PILOT_ORG_ID } },
  });

  const seed = spawnSync("node", ["scripts/seed-demo-data.mjs", "--reset"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (seed.status !== 0) {
    throw new Error("seed-demo-data.mjs --reset failed");
  }

  await assertPilotUntouched({ pilotReservations });

  const organization = await db.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(`Demo org missing after seed: ${DEMO_ORG_NAME}`);
  }

  const properties = await db.property.findMany({
    where: { organizationId: organization.id },
    orderBy: { unitNumber: "asc" },
    select: { id: true, unitNumber: true, baseRate: true },
  });

  if (properties.length < 4) {
    throw new Error(`Expected 4 demo properties, got ${properties.length}`);
  }

  const today = todayUtcDate();
  const june = (day) => dateOnly(2026, 6, day);

  const patches = [
    {
      propertyId: properties[0].id,
      key: "past-airbnb",
      data: {
        ...guestPatch(SYNTHETIC.pedro),
        checkIn: june(1),
        checkOut: june(5),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[0].id,
      key: "active-booking",
      data: {
        ...guestPatch(SYNTHETIC.maria),
        checkIn: june(16),
        checkOut: june(19),
        status: ReservationStatus.CHECKED_IN,
        paymentStatus: "PAID",
        platform: "AIRBNB",
      },
    },
    {
      propertyId: properties[0].id,
      key: "checkout-today",
      data: {
        ...guestPatch(SYNTHETIC.pedro),
        checkIn: june(8),
        checkOut: june(10),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[0].id,
      key: "upcoming-direct",
      data: {
        ...guestPatch(SYNTHETIC.maria),
        checkIn: addDays(today, 1),
        checkOut: addDays(today, 5),
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PENDING",
        platform: "DIRECT",
      },
    },
    {
      propertyId: properties[1].id,
      key: "past-airbnb",
      data: {
        ...guestPatch(SYNTHETIC.pedro),
        checkIn: june(3),
        checkOut: june(7),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[1].id,
      key: "active-booking",
      data: {
        ...guestPatch(SYNTHETIC.juan),
        checkIn: june(17),
        checkOut: june(20),
        status: ReservationStatus.CHECKED_IN,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[1].id,
      key: "checkout-today",
      data: {
        ...guestPatch(SYNTHETIC.laura),
        checkIn: june(6),
        checkOut: june(8),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "DIRECT",
      },
    },
    {
      propertyId: properties[1].id,
      key: "upcoming-direct",
      data: {
        ...guestPatch(SYNTHETIC.juan),
        checkIn: addDays(today, 3),
        checkOut: addDays(today, 7),
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PENDING",
        platform: "DIRECT",
      },
    },
    {
      propertyId: properties[2].id,
      key: "past-airbnb",
      data: {
        ...guestPatch(SYNTHETIC.ana),
        checkIn: june(5),
        checkOut: june(9),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[2].id,
      key: "active-booking",
      data: {
        ...guestPatch(SYNTHETIC.laura),
        checkIn: june(15),
        checkOut: june(18),
        status: ReservationStatus.CHECKED_IN,
        paymentStatus: "PAID",
        platform: "AIRBNB",
      },
    },
    {
      propertyId: properties[2].id,
      key: "checkout-today",
      data: {
        ...guestPatch(SYNTHETIC.camila),
        checkIn: june(7),
        checkOut: june(9),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[2].id,
      key: "upcoming-direct",
      data: {
        ...guestPatch(SYNTHETIC.laura),
        checkIn: addDays(today, 5),
        checkOut: addDays(today, 9),
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PENDING",
        platform: "DIRECT",
      },
    },
    {
      propertyId: properties[3].id,
      key: "past-airbnb",
      data: {
        ...guestPatch(SYNTHETIC.pedro),
        checkIn: june(7),
        checkOut: june(11),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[3].id,
      key: "active-booking",
      data: {
        ...guestPatch(SYNTHETIC.andres),
        checkIn: june(19),
        checkOut: june(22),
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PAID",
        platform: "DIRECT",
      },
    },
    {
      propertyId: properties[3].id,
      key: "checkout-today",
      data: {
        ...guestPatch(SYNTHETIC.juan),
        checkIn: june(8),
        checkOut: june(10),
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: "PAID",
        platform: "BOOKING",
      },
    },
    {
      propertyId: properties[3].id,
      key: "upcoming-direct",
      data: {
        ...guestPatch(SYNTHETIC.ana),
        checkIn: addDays(today, 2),
        checkOut: addDays(today, 6),
        status: ReservationStatus.CONFIRMED,
        paymentStatus: "PENDING",
        platform: "DIRECT",
      },
    },
  ];

  const reservations = await db.reservation.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) } },
    select: {
      id: true,
      propertyId: true,
      reservationCode: true,
      checkIn: true,
      status: true,
    },
    orderBy: [{ propertyId: "asc" }, { createdAt: "asc" }],
  });

  const byProperty = new Map();
  for (const row of reservations) {
    const list = byProperty.get(row.propertyId) ?? [];
    list.push(row);
    byProperty.set(row.propertyId, list);
  }

  const keys = ["past-airbnb", "active-booking", "checkout-today", "upcoming-direct"];
  let updated = 0;

  for (const patch of patches) {
    const list = byProperty.get(patch.propertyId) ?? [];
    const keyIndex = keys.indexOf(patch.key);
    const target = list[keyIndex];
    if (!target) {
      throw new Error(`Reservation slot missing: ${patch.propertyId} ${patch.key}`);
    }

    await db.reservation.update({
      where: { id: target.id },
      data: {
        ...patch.data,
        icalUid: null,
        totalAmount: roundAmount(patch.data.totalAmount),
      },
    });

    await db.reservationGuest.updateMany({
      where: { reservationId: target.id, isPrimary: true },
      data: {
        fullName: patch.data.guestName,
        email: patch.data.guestEmail,
        phone: patch.data.guestPhone,
      },
    });

    updated += 1;
  }

  for (const property of properties) {
    const roundedBase = roundAmount(property.baseRate);
    await db.property.update({
      where: { id: property.id },
      data: {
        ...(roundedBase !== String(property.baseRate) ? { baseRate: roundedBase } : {}),
        icalUrl: "https://demo.pragmapms.com/marketing.ics",
      },
    });
  }

  await assertPilotUntouched({ pilotReservations });

  const arrivals = await db.reservation.findMany({
    where: {
      property: { organizationId: organization.id },
      status: ReservationStatus.CONFIRMED,
      checkIn: { gte: today, lte: addDays(today, 7) },
    },
    select: { guestName: true, checkIn: true, totalAmount: true },
    orderBy: { checkIn: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "0F-1b",
        organizationId: organization.id,
        organizationName: organization.name,
        reservationsPatched: updated,
        pilotReservationsUnchanged: pilotReservations,
        upcomingArrivals: arrivals.map((a) => ({
          guestName: a.guestName,
          checkIn: a.checkIn.toISOString().slice(0, 10),
          totalAmount: String(a.totalAmount),
        })),
        captureAs: "platform owner impersonation",
        note: "Solo org demo. Pilot URBA Nova intacto.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("0F-1b prepare failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
