/**
 * P0 Reservation Integrity Audit — pilot tenant
 * node scripts/_p0-reservation-integrity-audit.mjs
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = process.argv.find((a) => a.startsWith("--org="))?.slice(6)
  ?? "cmplxfg0a000105jrs0gqtwyc";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function hasActiveIcal(url) {
  if (!url) return false;
  const t = url.trim();
  if (!t) return false;
  try {
    const n = t.replace(/^webcal:\/\//i, "https://");
    new URL(n.startsWith("http") ? n : `https://${n}`);
    return true;
  } catch {
    return false;
  }
}

function isHistorical(uid) {
  return uid?.trim().toLowerCase().startsWith("pragma-historical:");
}

function isGhost(row) {
  if (isHistorical(row.icalUid)) return false;
  if (row.platform === "BOOKING") return true;
  if (row.platform === "AIRBNB") {
    if (!row.icalUid) return true;
    if (row.status === "CANCELLED") return true;
    if (!hasActiveIcal(row.property.icalUrl)) return true;
    return false;
  }
  if (row.icalUid && !hasActiveIcal(row.property.icalUrl)) return true;
  return false;
}

async function main() {
  const all = await db.reservation.findMany({
    where: { property: { organizationId: ORG } },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      icalUid: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      property: { select: { id: true, name: true, icalUrl: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  const byStatus = {};
  const byPlatform = {};
  for (const r of all) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + 1;
  }

  const ghosts = all.filter(isGhost);
  const historical = all.filter((r) => isHistorical(r.icalUid));
  const cancelled = all.filter((r) => r.status === "CANCELLED");
  const cancelledAirbnb = cancelled.filter(
    (r) => r.platform === "AIRBNB" && !isHistorical(r.icalUid),
  );

  const calendarVisible = all.filter(
    (r) =>
      r.status !== "CANCELLED" &&
      !(
        (r.platform === "AIRBNB" && r.icalUid && !hasActiveIcal(r.property.icalUrl)) ||
        (r.icalUid && !hasActiveIcal(r.property.icalUrl) && r.platform === "AIRBNB")
      ),
  );

  const financeEligible = all.filter(
    (r) =>
      !["CANCELLED", "BLOCKED"].includes(r.status) &&
      (hasActiveIcal(r.property.icalUrl) ||
        !r.icalUid ||
        r.platform !== "AIRBNB"),
  );

  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        org: ORG,
        totalInDb: all.length,
        byStatus,
        byPlatform,
        historicalBackfill: historical.length,
        cancelledTotal: cancelled.length,
        cancelledAirbnbWouldPurge: cancelledAirbnb.length,
        ghostPurgeCandidates: ghosts.length,
        calendarWouldShow: calendarVisible.length,
        financeWouldInclude: financeEligible.length,
        ghostBreakdown: {
          booking: ghosts.filter((r) => r.platform === "BOOKING").length,
          airbnbNoUid: ghosts.filter((r) => r.platform === "AIRBNB" && !r.icalUid).length,
          airbnbCancelled: ghosts.filter(
            (r) => r.platform === "AIRBNB" && r.status === "CANCELLED",
          ).length,
          orphanIcal: ghosts.filter(
            (r) => r.icalUid && !hasActiveIcal(r.property.icalUrl),
          ).length,
        },
        ghostSamples: ghosts.slice(0, 15).map((r) => ({
          id: r.id,
          guest: r.guestName,
          status: r.status,
          platform: r.platform,
          icalUid: r.icalUid?.slice(0, 50) ?? null,
          property: r.property.name,
          checkIn: r.checkIn.toISOString().slice(0, 10),
          updatedAt: r.updatedAt.toISOString(),
        })),
        allReservations: all.map((r) => ({
          id: r.id,
          guest: r.guestName,
          property: r.property.name,
          checkIn: r.checkIn.toISOString().slice(0, 10),
          checkOut: r.checkOut.toISOString().slice(0, 10),
          status: r.status,
          platform: r.platform,
          icalUid: r.icalUid?.slice(0, 50) ?? null,
          amount: String(r.totalAmount),
          isGhost: isGhost(r),
        })),
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
