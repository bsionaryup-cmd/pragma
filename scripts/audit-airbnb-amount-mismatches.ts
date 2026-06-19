/**
 * Audita discrepancias entre totalAmount persistido y monto autoritativo del email Airbnb.
 *
 *   npx tsx scripts/audit-airbnb-amount-mismatches.ts [organizationId]
 */
import { config } from "dotenv";
import {
  BookingPlatform,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { pickFinanceRevenueEmailEvents } from "@/lib/finance/reservation-finance-trace";
import {
  buildReservationRevenueSourcesFromEmailEvent,
  resolveFinanceReservationRevenueAmount,
  resolveReservationRevenueAmount,
} from "@/lib/finance/reservation-revenue-amount";
import { pickAuthoritativeHostRevenueAmount, pickReservationAmount } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { refreshAuditSignalsFromRaw } from "@/modules/airbnb-email/repair/refresh-audit-signals-from-raw";

config();
config({ path: ".env.local", override: true });

const orgId = process.argv[2]?.trim() || "cmplxfg0a000105jrs0gqtwyc";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readAmount(value: unknown): number {
  if (value == null) return 0;
  const n =
    typeof value === "object" && value !== null && "toNumber" in value
      ? Number((value as { toNumber: () => number }).toNumber())
      : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const reservations = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      property: { organizationId: orgId },
    },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      icalUid: true,
      totalAmount: true,
      checkIn: true,
      status: true,
      platform: true,
      emailEvents: {
        select: {
          id: true,
          eventKind: true,
          reservationId: true,
          enrichedFields: true,
          payload: true,
          audit: {
            select: {
              parsedPayload: true,
              rawEmail: true,
              subject: true,
            },
          },
        },
      },
    },
    orderBy: { checkIn: "desc" },
  });

  const statusById = new Map(
    reservations.map((row) => [row.id, row.status]),
  );

  const mismatches: Array<Record<string, unknown>> = [];
  let zeroStored = 0;
  let noEmailAmount = 0;

  for (const row of reservations) {
    const stored = readAmount(row.totalAmount);
    if (stored === 0) zeroStored += 1;

    const picked = pickFinanceRevenueEmailEvents(row.emailEvents, statusById);
    const best = picked.get(row.id);
    if (!best) {
      if (stored === 0) noEmailAmount += 1;
      continue;
    }

    const refreshed = refreshAuditSignalsFromRaw({
      parsedPayload: best.audit.parsedPayload,
      rawEmail: best.audit.rawEmail,
      subject: best.audit.subject,
    });
    const pickAmount =
      (refreshed ? pickAuthoritativeHostRevenueAmount(refreshed) : null) ??
      (refreshed ? pickReservationAmount(refreshed) : null);

    const sources = buildReservationRevenueSourcesFromEmailEvent(best);
    const financeAmount = resolveFinanceReservationRevenueAmount(row, sources);
    const rawResolved = resolveReservationRevenueAmount({
      totalAmount: row.totalAmount,
      ...sources,
    });

    const authoritative = pickAmount ?? financeAmount;
    if (authoritative <= 0) {
      if (stored === 0) noEmailAmount += 1;
      continue;
    }

    const delta = Math.abs(stored - authoritative);
    const deltaPct = stored > 0 ? delta / authoritative : 1;
    if (delta < 1) continue;

    mismatches.push({
      id: row.id,
      guest: row.guestName,
      checkIn: row.checkIn.toISOString().slice(0, 10),
      status: row.status,
      code: row.reservationCode,
      stored,
      authoritative,
      financeAmount,
      rawResolved,
      deltaPct: Number(deltaPct.toFixed(3)),
      eventKind: best.eventKind,
      hostPayout: refreshed?.hostPayoutAmount,
      gross: refreshed?.grossAmount,
    });
  }

  mismatches.sort((a, b) => Number(b.deltaPct) - Number(a.deltaPct));

  console.log(
    JSON.stringify(
      {
        organizationId: orgId,
        scanned: reservations.length,
        zeroStored,
        noEmailAmount,
        mismatches: mismatches.length,
        top: mismatches.slice(0, 25),
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
