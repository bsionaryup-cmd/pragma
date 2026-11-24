/**
 * Deep-dive one reservation enrichment trail.
 *   npx tsx scripts/_audit-enrichment-reservation-detail.ts [reservationId]
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

async function main() {
  const rid = process.argv[2] || "cms6fztsq000004l3n664gyiw";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const r = await db.reservation.findUnique({
      where: { id: rid },
      select: {
        id: true,
        guestName: true,
        guestFirstName: true,
        guestLastName: true,
        reservationCode: true,
        guestEmail: true,
        guestPhone: true,
        adults: true,
        children: true,
        infants: true,
        checkIn: true,
        checkOut: true,
        platform: true,
        status: true,
        totalAmount: true,
        currency: true,
        icalUid: true,
        propertyId: true,
        guestRegistrationCompletedAt: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    const code = r?.reservationCode ?? null;
    const audits = await db.emailIngestionAudit.findMany({
      where: {
        OR: [
          { reservationId: rid },
          ...(code
            ? [
                {
                  parsedPayload: {
                    path: ["confirmationCode"],
                    equals: code,
                  },
                } as const,
              ]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        processingStatus: true,
        classification: true,
        matchMethod: true,
        matchConfidence: true,
        reservationId: true,
        subject: true,
        createdAt: true,
        errorReason: true,
        parsedPayload: true,
      },
    });

    const events = await db.reservationEmailEvent.findMany({
      where: { reservationId: rid },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        eventKind: true,
        createdAt: true,
        enrichedFields: true,
        confirmationCode: true,
        matchMethod: true,
        auditId: true,
      },
    });

    const sepId = "cmse92rxu000028tyeshdpjlt";
    const sep = await db.reservation.findUnique({
      where: { id: sepId },
      select: {
        id: true,
        guestName: true,
        reservationCode: true,
        guestEmail: true,
        adults: true,
        children: true,
        checkIn: true,
        checkOut: true,
        totalAmount: true,
        guestRegistrationCompletedAt: true,
      },
    });

    const sepEvents = await db.reservationEmailEvent.findMany({
      where: { reservationId: sepId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        eventKind: true,
        createdAt: true,
        enrichedFields: true,
        confirmationCode: true,
        matchMethod: true,
      },
    });

    const sepAudits = await db.emailIngestionAudit.findMany({
      where: { reservationId: sepId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        processingStatus: true,
        classification: true,
        matchMethod: true,
        subject: true,
        createdAt: true,
      },
    });

    // MANUAL_REVIEW linked vs blocked enrichment in last 14d
    const orgId = "cmplxfg0a000105jrs0gqtwyc";
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const manualLinked = await db.emailIngestionAudit.count({
      where: {
        organizationId: orgId,
        processingStatus: "MANUAL_REVIEW",
        reservationId: { not: null },
        classification: {
          in: ["CONFIRMED", "CHECKIN_REMINDER", "UPDATED", "EXTENDED"],
        },
        createdAt: { gte: since },
      },
    });
    const manualUnlinkedEnrichable = await db.emailIngestionAudit.count({
      where: {
        organizationId: orgId,
        processingStatus: "MANUAL_REVIEW",
        reservationId: null,
        classification: {
          in: ["CONFIRMED", "CHECKIN_REMINDER", "UPDATED", "EXTENDED"],
        },
        createdAt: { gte: since },
      },
    });
    const processedLinked = await db.emailIngestionAudit.count({
      where: {
        organizationId: orgId,
        processingStatus: "PROCESSED",
        reservationId: { not: null },
        classification: {
          in: ["CONFIRMED", "CHECKIN_REMINDER", "UPDATED", "EXTENDED"],
        },
        createdAt: { gte: since },
      },
    });

    console.log(
      JSON.stringify(
        {
          focus: {
            reservation: r,
            audits: audits.map((a) => ({
              id: a.id,
              processingStatus: a.processingStatus,
              classification: a.classification,
              matchMethod: a.matchMethod,
              matchConfidence: a.matchConfidence,
              reservationId: a.reservationId,
              subject: a.subject,
              createdAt: a.createdAt,
              errorReason: a.errorReason,
              payloadGuestName:
                a.parsedPayload &&
                typeof a.parsedPayload === "object" &&
                "guestName" in (a.parsedPayload as object)
                  ? (a.parsedPayload as { guestName?: string }).guestName
                  : null,
              payloadCode:
                a.parsedPayload &&
                typeof a.parsedPayload === "object" &&
                "confirmationCode" in (a.parsedPayload as object)
                  ? (a.parsedPayload as { confirmationCode?: string })
                      .confirmationCode
                  : null,
            })),
            events,
          },
          recentlyImported: {
            reservation: sep,
            events: sepEvents,
            audits: sepAudits,
          },
          org14d: {
            manualLinkedEnrichable: manualLinked,
            manualUnlinkedEnrichable,
            processedLinkedEnrichable: processedLinked,
          },
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
