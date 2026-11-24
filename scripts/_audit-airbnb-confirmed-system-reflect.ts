/**
 * Full audit: Airbnb reservations reflected in system vs calendar visibility.
 * Read-only. Does not change filters.
 *
 *   npx tsx scripts/_audit-airbnb-confirmed-system-reflect.ts
 */
import { config } from "dotenv";
import { BookingPlatform, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { notOrphanAirbnbImportFilter } from "../src/lib/airbnb/ical-sync-utils";
import { PILOT_PMS_ORGANIZATION_ID } from "../src/lib/platform/constants.client";

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

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const orgId =
      process.env.PILOT_PMS_ORGANIZATION_ID?.trim() || PILOT_PMS_ORGANIZATION_ID;

    const properties = await db.property.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        status: true,
        icalUrl: true,
        lastIcalSyncedAt: true,
      },
      orderBy: { name: "asc" },
    });

    const airbnbAll = await db.reservation.findMany({
      where: {
        platform: BookingPlatform.AIRBNB,
        property: { organizationId: orgId },
      },
      select: {
        id: true,
        guestName: true,
        status: true,
        checkIn: true,
        checkOut: true,
        icalUid: true,
        createdAt: true,
        updatedAt: true,
        propertyId: true,
        property: {
          select: {
            id: true,
            name: true,
            status: true,
            icalUrl: true,
          },
        },
      },
      orderBy: { checkIn: "desc" },
    });

    const now = new Date();
    const viewportStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 120),
    );
    const viewportEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 120),
    );

    const calendarVisibleIds = new Set(
      (
        await db.reservation.findMany({
          where: {
            AND: [
              { platform: BookingPlatform.AIRBNB },
              { property: { organizationId: orgId } },
              { status: { notIn: ["CANCELLED"] } },
              { checkIn: { lte: viewportEnd } },
              { checkOut: { gt: viewportStart } },
              notOrphanAirbnbImportFilter(),
            ],
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    );

    const byStatus: Record<string, number> = {};
    for (const r of airbnbAll) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    const confirmed = airbnbAll.filter((r) => r.status === "CONFIRMED");
    const activeStatuses = new Set([
      "CONFIRMED",
      "CHECKED_IN",
      "CHECKOUT_TODAY",
      "CHECKED_OUT",
    ]);

    const confirmedAnalysis = confirmed.map((r) => {
      const icalOk = hasActiveIcal(r.property.icalUrl);
      const propertyActive = r.property.status === "ACTIVE";
      const inViewport =
        r.checkIn <= viewportEnd && r.checkOut > viewportStart;
      const inCalendarQuery = calendarVisibleIds.has(r.id);
      const wouldHide =
        !inCalendarQuery || !propertyActive || !inViewport;
      let hideReason: string | null = null;
      if (r.status === "CANCELLED") hideReason = "cancelled";
      else if (!icalOk) hideReason = "orphan_missing_ical_url";
      else if (!propertyActive) hideReason = "property_not_active";
      else if (!inViewport) hideReason = "outside_viewport_120d";
      else if (!inCalendarQuery) hideReason = "filtered_from_calendar_query";
      return {
        id: r.id,
        guest: r.guestName,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        property: r.property.name,
        propertyStatus: r.property.status,
        hasIcalUrl: icalOk,
        hasIcalUid: Boolean(r.icalUid),
        inViewport120: inViewport,
        inCalendarQuery,
        wouldRenderOnCalendar: inCalendarQuery && propertyActive,
        hideReason: wouldHide ? hideReason : null,
      };
    });

    const hiddenConfirmed = confirmedAnalysis.filter((r) => !r.wouldRenderOnCalendar);

    const propsWithoutIcal = properties.filter(
      (p) => p.status === "ACTIVE" && !hasActiveIcal(p.icalUrl),
    );

    const airbnbOnBrokenIcal = airbnbAll.filter(
      (r) =>
        activeStatuses.has(r.status) &&
        !hasActiveIcal(r.property.icalUrl),
    );

    const futureConfirmed = confirmedAnalysis.filter(
      (r) => r.checkOut >= now.toISOString().slice(0, 10),
    );

    console.log(
      JSON.stringify(
        {
          organizationId: orgId,
          auditedAt: now.toISOString(),
          properties: {
            total: properties.length,
            active: properties.filter((p) => p.status === "ACTIVE").length,
            withIcalUrl: properties.filter((p) => hasActiveIcal(p.icalUrl))
              .length,
            activeWithoutIcal: propsWithoutIcal.map((p) => ({
              id: p.id,
              name: p.name,
              lastIcalSyncedAt: p.lastIcalSyncedAt,
            })),
            lastSync: properties.map((p) => ({
              name: p.name,
              status: p.status,
              hasIcal: hasActiveIcal(p.icalUrl),
              lastIcalSyncedAt: p.lastIcalSyncedAt,
            })),
          },
          airbnbReservations: {
            total: airbnbAll.length,
            byStatus,
            confirmedCount: confirmed.length,
            confirmedFutureOrToday: futureConfirmed.length,
            confirmedHiddenOnCalendar: hiddenConfirmed.length,
            confirmedHidden: hiddenConfirmed,
            confirmedVisibleSample: confirmedAnalysis
              .filter((r) => r.wouldRenderOnCalendar)
              .slice(0, 15),
            allConfirmed: confirmedAnalysis,
            nonCancelledOnPropertyWithoutIcal: airbnbOnBrokenIcal.map((r) => ({
              id: r.id,
              status: r.status,
              guest: r.guestName,
              property: r.property.name,
            })),
          },
          verdict:
            hiddenConfirmed.length === 0 && airbnbOnBrokenIcal.length === 0
              ? "PASS: all CONFIRMED Airbnb in org are in DB and would render on calendar (orphan/ACTIVE/viewport OK)."
              : hiddenConfirmed.length > 0
                ? "GAP: some CONFIRMED Airbnb exist in DB but are HIDDEN from calendar by filters/property."
                : "WARN: non-cancelled Airbnb on properties without icalUrl (orphan risk).",
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
