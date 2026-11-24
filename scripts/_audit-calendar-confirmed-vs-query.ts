/**
 * Deep compare CONFIRMED vs calendar query (viewport + orphan + ACTIVE property).
 *   npx tsx scripts/_audit-calendar-confirmed-vs-query.ts
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { notOrphanAirbnbImportFilter } from "../src/lib/airbnb/ical-sync-utils";

config();
config({ path: ".env.local", override: true });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 120),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 120),
    );

    const confirmed = await db.reservation.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        guestName: true,
        platform: true,
        checkIn: true,
        checkOut: true,
        icalUid: true,
        property: {
          select: { name: true, status: true, icalUrl: true },
        },
      },
    });

    const inCalQuery = await db.reservation.findMany({
      where: {
        AND: [
          { status: { notIn: ["CANCELLED"] } },
          { checkIn: { lte: end } },
          { checkOut: { gt: start } },
          notOrphanAirbnbImportFilter(),
        ],
      },
      select: { id: true, propertyId: true },
    });
    const calIds = new Set(inCalQuery.map((r) => r.id));

    const activeProps = await db.property.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const activePropIds = new Set(activeProps.map((p) => p.id));

    const report = confirmed.map((r) => {
      const inViewport = r.checkIn <= end && r.checkOut > start;
      const inCalendarLoad = calIds.has(r.id);
      const propertyActive = r.property.status === "ACTIVE";
      return {
        id: r.id,
        guest: r.guestName,
        platform: r.platform,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        property: r.property.name,
        propertyStatus: r.property.status,
        inViewport120: inViewport,
        inCalendarQuery: inCalendarLoad,
        wouldRenderBar: inCalendarLoad && propertyActive,
        mismatch:
          inViewport && propertyActive && !inCalendarLoad
            ? "in_db_confirmed_active_but_filtered_from_calendar_query"
            : null,
      };
    });

    console.log(
      JSON.stringify(
        {
          confirmedScanned: report.length,
          calendarQueryCount: inCalQuery.length,
          activeProperties: activePropIds.size,
          mismatches: report.filter((x) => x.mismatch),
          outsideViewport: report.filter((x) => !x.inViewport120),
          inactiveProperty: report.filter((x) => x.propertyStatus !== "ACTIVE"),
          recent: report.slice(0, 12),
          conclusion:
            report.filter((x) => x.mismatch).length === 0
              ? "No CONFIRMED+ACTIVE+viewport rows are hidden by orphan/status filters in sample. If UI still misses a bar, cause is client viewport scroll, property search filter, tenant scope, or a specific reservation outside this sample — provide reservationId."
              : "Found CONFIRMED rows excluded by calendar query despite ACTIVE property + viewport — investigate orphan filter.",
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
