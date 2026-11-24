/**
 * Why did Sergio stay "Huésped Airbnb" after enrichment + GR?
 *   npx tsx scripts/_audit-sergio-guest-name-trail.ts
 */
import { config } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

async function main() {
  const rid = "cms6fztsq000004l3n664gyiw";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const r = await db.reservation.findUnique({
      where: { id: rid },
      select: {
        guestName: true,
        guestFirstName: true,
        guestLastName: true,
        guestRegistrationCompletedAt: true,
        guestEmail: true,
        reservationCode: true,
        updatedAt: true,
        createdAt: true,
        totalAmount: true,
      },
    });

    // Guest model may be named differently — probe via reservation relation
    const withGuests = await db.reservation.findUnique({
      where: { id: rid },
      select: {
        guests: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const acts = await db.reservationActivity.findMany({
      where: { reservationId: rid },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: {
        activityType: true,
        title: true,
        createdAt: true,
        source: true,
      },
    });

    const audit = await db.emailIngestionAudit.findUnique({
      where: { id: "cms6fxrb4000204l9kea4btz6" },
      select: {
        parsedPayload: true,
        processingStatus: true,
        matchMethod: true,
        matchConfidence: true,
        reservationId: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        subject: true,
      },
    });

    const payload = audit?.parsedPayload as Record<string, unknown> | null;
    const signals =
      payload && typeof payload.signals === "object" && payload.signals
        ? (payload.signals as Record<string, unknown>)
        : payload;

    // Does UI display path have enrichment name?
    const confirmEvent = await db.reservationEmailEvent.findFirst({
      where: { reservationId: rid, eventKind: "CONFIRMED" },
      select: { enrichedFields: true, createdAt: true },
    });

    // Active Airbnb with placeholder name BUT enrichment event has real name
    const orgId = "cmplxfg0a000105jrs0gqtwyc";
    const placeholders = await db.$queryRaw<
      Array<{
        id: string;
        guestName: string;
        code: string | null;
        grAt: Date | null;
        enrichName: string | null;
      }>
    >(Prisma.sql`
      SELECT r.id, r."guestName", r."reservationCode" as code,
             r."guestRegistrationCompletedAt" as "grAt",
             (e."enrichedFields"->>'guestName') as "enrichName"
      FROM reservations r
      JOIN properties p ON p.id = r."propertyId"
      LEFT JOIN LATERAL (
        SELECT ee."enrichedFields"
        FROM reservation_email_events ee
        WHERE ee."reservationId" = r.id
          AND ee."eventKind" = 'CONFIRMED'
          AND ee."enrichedFields"->>'guestName' IS NOT NULL
        ORDER BY ee."createdAt" DESC
        LIMIT 1
      ) e ON true
      WHERE p."organizationId" = ${orgId}
        AND r.platform = 'AIRBNB'
        AND r.status NOT IN ('CANCELLED', 'CHECKED_OUT')
        AND (
          lower(r."guestName") IN ('huésped airbnb', 'airbnb guest', 'reserved', 'airbnb')
          OR r."guestName" ILIKE 'Huésped%'
        )
      ORDER BY r."checkIn" ASC
    `);

    console.log(
      JSON.stringify(
        {
          reservation: r,
          guests: withGuests?.guests ?? [],
          activities: acts,
          confirmAudit: {
            status: audit?.processingStatus,
            method: audit?.matchMethod,
            confidence: audit?.matchConfidence,
            reservationId: audit?.reservationId,
            createdAt: audit?.createdAt,
            updatedAt: audit?.updatedAt,
            processedAt: audit?.processedAt,
            subject: audit?.subject,
            signalGuestName:
              signals && typeof signals === "object"
                ? (signals as { guestName?: string }).guestName
                : null,
            signalCode:
              signals && typeof signals === "object"
                ? (signals as { confirmationCode?: string }).confirmationCode
                : null,
            topKeys: payload ? Object.keys(payload) : [],
          },
          confirmEventGuestName:
            confirmEvent?.enrichedFields &&
            typeof confirmEvent.enrichedFields === "object"
              ? (confirmEvent.enrichedFields as { guestName?: string }).guestName
              : null,
          placeholderWithEnrichmentName: placeholders,
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
