/**
 * Read-only audit: why CONFIRMED reservations might not appear on calendar.
 * Does NOT modify orphan filters — only reports evidence.
 *
 * Usage:
 *   npx tsx scripts/_audit-calendar-missing-reservation.ts
 *   npx tsx scripts/_audit-calendar-missing-reservation.ts <reservationId>
 */
import { config } from "dotenv";
import { BookingPlatform, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  activeIcalUrlOnPropertyFilter,
  notOrphanAirbnbImportFilter,
} from "../src/lib/airbnb/ical-sync-utils";

config();
config({ path: ".env.local", override: true });

function hasActiveIcal(icalUrl: string | null | undefined): boolean {
  const u = icalUrl?.trim() || "";
  return (
    u.startsWith("https://") ||
    u.startsWith("http://") ||
    u.startsWith("webcal://")
  );
}

function passesOrphanFilter(row: {
  platform: BookingPlatform;
  icalUid: string | null;
  propertyIcalUrl: string | null;
}): boolean {
  if (hasActiveIcal(row.propertyIcalUrl)) return true;
  return row.icalUid == null && row.platform !== BookingPlatform.AIRBNB;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const id = process.argv[2]?.trim();
    if (id) {
      const r = await db.reservation.findUnique({
        where: { id },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              status: true,
              icalUrl: true,
              organizationId: true,
            },
          },
        },
      });
      if (!r) {
        console.log(JSON.stringify({ id, found: false }, null, 2));
        return;
      }
      const orphanPass = passesOrphanFilter({
        platform: r.platform,
        icalUid: r.icalUid,
        propertyIcalUrl: r.property.icalUrl,
      });
      const visibleInQuery = await db.reservation.count({
        where: {
          AND: [
            { id: r.id },
            { status: { notIn: ["CANCELLED"] } },
            notOrphanAirbnbImportFilter(),
          ],
        },
      });
      console.log(
        JSON.stringify(
          {
            id: r.id,
            found: true,
            status: r.status,
            platform: r.platform,
            icalUid: r.icalUid,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            property: {
              id: r.property.id,
              name: r.property.name,
              status: r.property.status,
              icalUrl: r.property.icalUrl,
              hasActiveIcal: hasActiveIcal(r.property.icalUrl),
            },
            filters: {
              excludedAsCancelled: r.status === "CANCELLED",
              propertyActive: r.property.status === "ACTIVE",
              passesOrphanAirbnbFilter: orphanPass,
              visibleInCalendarQuery: visibleInQuery === 1,
            },
            likelyHideReason: !orphanPass
              ? "orphan_airbnb_or_missing_ical"
              : r.property.status !== "ACTIVE"
                ? "property_not_active"
                : r.status === "CANCELLED"
                  ? "cancelled"
                  : visibleInQuery === 1
                    ? "should_appear_check_viewport_or_tenant_scope"
                    : "unknown_query_mismatch",
          },
          null,
          2,
        ),
      );
      return;
    }

    const rows = await db.reservation.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        property: {
          select: { id: true, name: true, status: true, icalUrl: true },
        },
      },
    });

    const summary = rows.map((r) => {
      const orphanPass = passesOrphanFilter({
        platform: r.platform,
        icalUid: r.icalUid,
        propertyIcalUrl: r.property.icalUrl,
      });
      return {
        id: r.id,
        guestName: r.guestName,
        platform: r.platform,
        property: r.property.name,
        propertyStatus: r.property.status,
        hasActiveIcal: hasActiveIcal(r.property.icalUrl),
        passesOrphanFilter: orphanPass,
        wouldHideOnCalendar: !orphanPass || r.property.status !== "ACTIVE",
        hideReason: !orphanPass
          ? "orphan_airbnb_or_missing_ical"
          : r.property.status !== "ACTIVE"
            ? "property_not_active"
            : null,
      };
    });

    const hidden = summary.filter((s) => s.wouldHideOnCalendar);
    console.log(
      JSON.stringify(
        {
          scanned: summary.length,
          hiddenOnCalendar: hidden.length,
          hidden,
          visibleSample: summary
            .filter((s) => !s.wouldHideOnCalendar)
            .slice(0, 5),
          note: "Orphan filter intentionally unchanged; ops fix = restore property icalUrl or confirm DIRECT booking.",
          activeIcalFilter: activeIcalUrlOnPropertyFilter(),
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
