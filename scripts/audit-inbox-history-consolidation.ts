/**
 * Auditoría histórica Bandeja de entrada (solo lectura).
 * npx tsx --require ./scripts/_mock-server-only.cjs scripts/audit-inbox-history-consolidation.ts
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { ReservationActivityType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { prismaDateToKey } from "@/lib/dates";
import { planInboxHistoryConsolidation } from "@/services/novedades/inbox-history-consolidation";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const orgId = "cmplxfg0a000105jrs0gqtwyc";

async function main() {
  const {
    getNovedadesInboxSnapshot,
    listNovedadesInboxItems,
  } = await import("@/services/novedades/novedades-inbox.service");
  const { listNovedadesUnlinkedInquiryItems } = await import(
    "@/services/novedades/novedades-unlinked-inquiry.service"
  );

  const scope = { organizationId: orgId, userId: "audit", role: "ADMIN" as const };

  const [snapshot, pendingRows, orphanAudits, activitiesWithoutRes] = await Promise.all([
    getNovedadesInboxSnapshot(scope, 120),
    db.reservationActivityPending.findMany({
      where: { organizationId: orgId, activityType: ReservationActivityType.AIRBNB_MESSAGE },
      select: { id: true, propertyId: true, createdAt: true, sourceEmailId: true },
    }),
    db.emailIngestionAudit.findMany({
      where: { organizationId: orgId, reservationId: null },
      select: { id: true, subject: true, createdAt: true },
      take: 200,
    }),
    db.reservationActivity.findMany({
      where: {
        reservation: { property: { organizationId: orgId } },
        activityType: ReservationActivityType.AIRBNB_MESSAGE,
      },
      select: { id: true, reservationId: true, sourceEmailId: true },
      take: 500,
    }),
  ]);

  const rawInquiries = await listNovedadesUnlinkedInquiryItems(scope, 80);
  const reservations = await db.reservation.findMany({
    where: { property: { organizationId: orgId } },
    select: {
      id: true,
      propertyId: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
    },
  });

  const pendingMeta = await db.reservationActivityPending.findMany({
    where: { id: { in: rawInquiries.map((row) => row.pendingActivityId) } },
    select: { id: true, propertyId: true, content: true },
  });
  const pendingById = new Map(pendingMeta.map((row) => [row.id, row]));

  const plan = planInboxHistoryConsolidation({
    inquiries: rawInquiries.map((inquiry) => ({
      pendingActivityId: inquiry.pendingActivityId,
      propertyId: pendingById.get(inquiry.pendingActivityId)?.propertyId ?? null,
      propertyHint: inquiry.propertyLabel,
      createdAt: inquiry.latestAt,
      guestName: inquiry.guestName,
      dateRangeLabel: inquiry.dateRangeLabel,
      subject: inquiry.subject,
      narrative: inquiry.latestNarrative,
      content: pendingById.get(inquiry.pendingActivityId)?.content ?? inquiry.latestNarrative,
    })),
    reservations: reservations.map((row) => ({
      reservationId: row.id,
      propertyId: row.propertyId,
      guestName: row.guestName,
      checkIn: prismaDateToKey(row.checkIn),
      checkOut: prismaDateToKey(row.checkOut),
      createdAt: row.createdAt.toISOString(),
    })),
    properties: (
      await db.property.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, unitNumber: true },
      })
    ).map((row) => ({
      propertyId: row.id,
      name: row.name,
      unitNumber: row.unitNumber,
    })),
  });

  const placeholderGuests = snapshot.items.filter((row) =>
    /hu[eé]sped airbnb/i.test(row.guestName),
  );
  const consultaAirbnb = [
    ...snapshot.unlinkedInquiries,
    ...rawInquiries.filter((row) => !snapshot.inquiryToReservationMap[row.pendingActivityId]),
  ].filter((row) => /^consulta airbnb$/i.test(row.guestName.trim()));

  const unifiedTotal =
    snapshot.items.length + snapshot.unlinkedInquiries.length;
  const rawUnified = rawInquiries.length + snapshot.items.length;

  const report = {
    orgId,
    generatedAt: new Date().toISOString(),
    totals: {
      reservationThreads: snapshot.items.length,
      unlinkedInquiriesAfterConsolidation: snapshot.unlinkedInquiries.length,
      rawInquiriesBeforeConsolidation: rawInquiries.length,
      unifiedConversationCount: unifiedTotal,
      pendingRows: pendingRows.length,
      orphanAudits: orphanAudits.length,
      guestMessageActivities: activitiesWithoutRes.length,
      reservationsInOrg: reservations.length,
    },
    consolidation: {
      absorbed: plan.stats.absorbedCount,
      consultaAirbnbBefore: plan.stats.consultaAirbnbBefore,
      consultaAirbnbAfterUnmatched: plan.stats.consultaAirbnbAfterUnmatched,
      matches: plan.matches,
    },
    quality: {
      placeholderGuestNamesInList: placeholderGuests.length,
      consultaAirbnbRemaining: consultaAirbnb.length,
      duplicateThreadRisk: Math.max(0, rawUnified - unifiedTotal),
      inquiryRedirects: Object.keys(snapshot.inquiryToReservationMap).length,
    },
    samples: {
      absorbed: plan.matches.slice(0, 10),
      remainingConsultaAirbnb: consultaAirbnb.slice(0, 10).map((row) => ({
        pendingActivityId: row.pendingActivityId,
        guestName: row.guestName,
        propertyLabel: row.propertyLabel,
        dateRangeLabel: row.dateRangeLabel,
      })),
    },
  };

  writeFileSync(
    "scripts/_audit-inbox-history-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(JSON.stringify(report.consolidation, null, 2));
  console.log(JSON.stringify(report.quality, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
