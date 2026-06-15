/**
 * Diagnóstico: reservas Airbnb sin enriquecer (nombres placeholder / sin eventos).
 * node scripts/audit-airbnb-enrichment-gaps.mjs
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingPlatform } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const PLACEHOLDERS = new Set([
  "huésped airbnb",
  "airbnb guest",
  "reserved",
  "reservado",
  "airbnb",
  "bloqueo airbnb",
]);

function isLikelyPlaceholder(name) {
  const n = name?.trim().toLowerCase();
  if (!n) return true;
  return PLACEHOLDERS.has(n);
}

async function main() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const reservations = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { not: "CANCELLED" },
      checkOut: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
      property: { select: { name: true, organization: { select: { name: true } } } },
      emailEvents: {
        select: {
          id: true,
          eventKind: true,
          enrichedFields: true,
          matchMethod: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  const gaps = [];
  for (const r of reservations) {
    const enrichedName =
      typeof r.emailEvents[0]?.enrichedFields === "object" &&
      r.emailEvents[0]?.enrichedFields &&
      !Array.isArray(r.emailEvents[0].enrichedFields)
        ? r.emailEvents[0].enrichedFields.guestName
        : null;

    const placeholder = isLikelyPlaceholder(r.guestName);
    const missingEnrichment = placeholder && !enrichedName;

    if (placeholder || missingEnrichment) {
      gaps.push({
        id: r.id,
        guestName: r.guestName,
        reservationCode: r.reservationCode,
        property: r.property.name,
        org: r.property.organization.name,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        emailEventCount: r.emailEvents.length,
        enrichedGuestName: enrichedName ?? null,
        latestEvent: r.emailEvents[0]
          ? {
              kind: r.emailEvents[0].eventKind,
              method: r.emailEvents[0].matchMethod,
              createdAt: r.emailEvents[0].createdAt.toISOString(),
            }
          : null,
        placeholder,
        missingEnrichment,
      });
    }
  }

  const unlinkedAudits = await db.emailIngestionAudit.count({
    where: {
      reservationId: null,
      classification: { in: ["CONFIRMED", "CHECKIN_REMINDER", "UPDATED", "EXTENDED"] },
      createdAt: { gte: since },
    },
  });

  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        recentAirbnbWithPlaceholderOrGap: gaps.length,
        unlinkedReservationAudits30d: unlinkedAudits,
        gaps,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
