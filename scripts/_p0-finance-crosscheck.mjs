/**
 * Finance vs reservation cross-check for pilot org.
 * node scripts/_p0-finance-crosscheck.mjs
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const ACCOUNTING = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
  ReservationStatus.CHECKED_OUT,
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const reservations = await db.reservation.findMany({
    where: { property: { organizationId: ORG } },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      reservationCode: true,
      property: { select: { unitNumber: true } },
    },
  });

  const monthlyPaid = {};
  const monthlyAllAccounting = {};
  let totalPaid = 0;

  for (const r of reservations) {
    if (!ACCOUNTING.includes(r.status)) continue;
    const month = dateKey(r.checkIn).slice(0, 7);
    const amount = Number(r.totalAmount);
    monthlyAllAccounting[month] = (monthlyAllAccounting[month] ?? 0) + amount;
    if (r.paymentStatus === PaymentStatus.PAID) {
      monthlyPaid[month] = (monthlyPaid[month] ?? 0) + amount;
      totalPaid += amount;
    }
  }

  const historical = reservations.filter((r) =>
    r.reservationCode?.startsWith("HM") ||
    r.reservationCode?.match(/^[A-Z0-9]{10}$/) ||
    dateKey(r.checkIn) < "2026-05-25",
  );

  const juneRecovered = reservations.filter((r) =>
    [
      "HMCNCARK3K",
      "HMYZWPD95M",
      "HM4SPXSTS2",
      "HMJDFHKS4R",
      "HMZMZBDTKN",
      "HMNWHJBYH5",
    ].includes(r.reservationCode ?? ""),
  );

  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        totalReservations: reservations.length,
        totalPaidReservationRevenue: totalPaid,
        monthlyPaidReservationRevenue: monthlyPaid,
        monthlyAllAccountingAmounts: monthlyAllAccounting,
        juneRecovered: juneRecovered.map((r) => ({
          code: r.reservationCode,
          guest: r.guestName,
          unit: r.property.unitNumber,
          checkIn: dateKey(r.checkIn),
          checkOut: dateKey(r.checkOut),
          status: r.status,
          amount: String(r.totalAmount),
          paymentStatus: r.paymentStatus,
        })),
        expectedAprilHistoricalRevenue: 1603198.16,
        expectedMayHistoricalRevenue: 4339774.07,
        checks: {
          aprilPaidMatches:
            Math.abs((monthlyPaid["2026-04"] ?? 0) - 1603198.16) < 1,
          mayPaidIncludesVictoria:
            (monthlyPaid["2026-05"] ?? 0) >= 5477179.03,
          juneRecoveredCount: juneRecovered.length === 6,
        },
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
