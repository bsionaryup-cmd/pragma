/**
 * Read-only: Airbnb email enrichment health for pilot org.
 *   npx tsx scripts/_audit-airbnb-enrichment-health.ts
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PILOT_PMS_ORGANIZATION_ID } from "../src/lib/platform/constants.client";

config();
config({ path: ".env.local", override: true });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const orgId =
    process.env.PILOT_PMS_ORGANIZATION_ID?.trim() || PILOT_PMS_ORGANIZATION_ID;

  try {
    const integration = await db.tenantAirbnbEmailIntegration.findFirst({
      where: { organizationId: orgId },
      select: {
        id: true,
        enabled: true,
        inboundEmailAddress: true,
        syncStatus: true,
        lastEmailReceivedAt: true,
        lastProcessedAt: true,
        lastError: true,
        updatedAt: true,
      },
    });

    const audits = await db.emailIngestionAudit.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        processingStatus: true,
        reservationId: true,
        propertyId: true,
        classification: true,
        matchMethod: true,
        matchConfidence: true,
        subject: true,
        createdAt: true,
        errorReason: true,
      },
    });

    const byStatus: Record<string, number> = {};
    let linked = 0;
    let unlinked = 0;
    const classifiedUnlinked = [];
    const processedUnlinked = [];
    const failed = [];

    for (const a of audits) {
      byStatus[a.processingStatus] = (byStatus[a.processingStatus] || 0) + 1;
      if (a.reservationId) linked += 1;
      else {
        unlinked += 1;
        if (a.processingStatus === "CLASSIFIED") classifiedUnlinked.push(a);
        if (
          a.processingStatus === "PROCESSED" ||
          a.processingStatus === "MANUAL_REVIEW"
        ) {
          processedUnlinked.push(a);
        }
      }
      if (a.processingStatus === "FAILED") failed.push(a);
    }

    const airbnbConfirmed = await db.reservation.findMany({
      where: {
        platform: "AIRBNB",
        status: { in: ["CONFIRMED", "CHECKOUT_TODAY", "CHECKED_IN"] },
        property: { organizationId: orgId },
      },
      select: {
        id: true,
        guestName: true,
        reservationCode: true,
        guestEmail: true,
        adults: true,
        children: true,
        checkIn: true,
        checkOut: true,
        guestRegistrationCompletedAt: true,
      },
      orderBy: { checkIn: "asc" },
      take: 30,
    });

    const placeholderish = airbnbConfirmed.filter((r) => {
      const n = (r.guestName || "").toLowerCase();
      return (
        !r.reservationCode ||
        n.includes("huésped") ||
        n.includes("huesped") ||
        n.includes("reserved") ||
        n.includes("airbnb") ||
        (r.adults === 1 && r.children === 0 && !r.guestEmail)
      );
    });

    const eventsRecent = await db.reservationEmailEvent.findMany({
      where: {
        reservation: { property: { organizationId: orgId } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        reservationId: true,
        eventKind: true,
        createdAt: true,
        enrichedFields: true,
      },
    });

    // Global: would durable retry pick CLASSIFIED? (evidence for fix)
    const classifiedWouldBeMissed = await db.emailIngestionAudit.count({
      where: {
        organizationId: orgId,
        reservationId: null,
        processingStatus: "CLASSIFIED",
        classification: {
          in: ["CONFIRMED", "CHECKIN_REMINDER", "UPDATED", "EXTENDED"],
        },
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    });

    const retryEligibleToday = await db.emailIngestionAudit.count({
      where: {
        organizationId: orgId,
        reservationId: null,
        processingStatus: { in: ["PROCESSED", "MANUAL_REVIEW"] },
        classification: {
          in: ["CONFIRMED", "CHECKIN_REMINDER", "UPDATED", "EXTENDED"],
        },
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    });

    console.log(
      JSON.stringify(
        {
          orgId,
          auditedAt: new Date().toISOString(),
          integration: integration
            ? {
                enabled: integration.enabled,
                syncStatus: integration.syncStatus,
                inboundEmailAddress: integration.inboundEmailAddress,
                lastEmailReceivedAt: integration.lastEmailReceivedAt,
                lastProcessedAt: integration.lastProcessedAt,
                lastError: integration.lastError,
              }
            : null,
          auditsSample: {
            n: audits.length,
            byStatus,
            linked,
            unlinked,
            classifiedUnlinkedCount: classifiedUnlinked.length,
            processedOrManualUnlinkedCount: processedUnlinked.length,
            failedCount: failed.length,
            classifiedUnlinkedSample: classifiedUnlinked.slice(0, 8).map((a) => ({
              id: a.id,
              classification: a.classification,
              subject: a.subject,
              createdAt: a.createdAt,
              error: a.errorReason,
            })),
            processedUnlinkedSample: processedUnlinked.slice(0, 8).map((a) => ({
              id: a.id,
              classification: a.classification,
              matchMethod: a.matchMethod,
              subject: a.subject,
              createdAt: a.createdAt,
            })),
            failedSample: failed.slice(0, 5).map((a) => ({
              id: a.id,
              error: a.errorReason,
              createdAt: a.createdAt,
            })),
          },
          retryJobEvidence: {
            lookback14d_CLASSIFIED_unlinked_enrichable: classifiedWouldBeMissed,
            lookback14d_PROCESSED_or_MANUAL_unlinked_enrichable: retryEligibleToday,
            note:
              "Durable retry only loads PROCESSED|MANUAL_REVIEW — CLASSIFIED orphans are skipped",
          },
          activeAirbnbReservations: {
            n: airbnbConfirmed.length,
            likelyNeedsEnrichment: placeholderish.length,
            placeholders: placeholderish.map((r) => ({
              id: r.id,
              guestName: r.guestName,
              code: r.reservationCode,
              email: r.guestEmail,
              adults: r.adults,
              checkIn: r.checkIn.toISOString().slice(0, 10),
              checkOut: r.checkOut.toISOString().slice(0, 10),
            })),
          },
          recentEmailEvents: eventsRecent.map((e) => ({
            id: e.id,
            reservationId: e.reservationId,
            kind: e.eventKind,
            createdAt: e.createdAt,
            hasEnrichedFields: Boolean(e.enrichedFields),
          })),
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
