/**
 * Diagnóstico profundo: reservas Airbnb recientes + auditorías de correo.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingPlatform } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const now = new Date();
  const upcoming = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { notIn: ["CANCELLED"] },
      checkOut: { gte: now },
    },
    orderBy: { checkIn: "asc" },
    take: 30,
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
      icalUid: true,
      propertyId: true,
      property: {
        select: {
          name: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
      emailEvents: {
        select: {
          eventKind: true,
          enrichedFields: true,
          matchMethod: true,
          matchConfidence: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const byGuestName = {};
  for (const r of upcoming) {
    const key = r.guestName?.trim() || "(empty)";
    byGuestName[key] = (byGuestName[key] ?? 0) + 1;
  }

  const placeholderUpcoming = upcoming.filter((r) => {
    const n = r.guestName?.trim().toLowerCase() ?? "";
    return (
      !n ||
      n === "huésped airbnb" ||
      n === "airbnb" ||
      n === "airbnb guest" ||
      n === "reserved" ||
      n === "reservado"
    );
  });

  const auditsForProps = await db.emailIngestionAudit.findMany({
    where: {
      propertyId: { in: [...new Set(placeholderUpcoming.map((r) => r.propertyId))] },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      propertyId: true,
      reservationId: true,
      classification: true,
      processingStatus: true,
      matchMethod: true,
      matchConfidence: true,
      createdAt: true,
      parsedPayload: true,
    },
  });

  const auditSummary = auditsForProps.map((a) => {
    const signals =
      a.parsedPayload &&
      typeof a.parsedPayload === "object" &&
      !Array.isArray(a.parsedPayload)
        ? a.parsedPayload.signals
        : null;
    const guestName =
      signals &&
      typeof signals === "object" &&
      !Array.isArray(signals) &&
      typeof signals.guestName === "string"
        ? signals.guestName
        : null;
    return {
      id: a.id,
      propertyId: a.propertyId,
      reservationId: a.reservationId,
      classification: a.classification,
      processingStatus: a.processingStatus,
      matchMethod: a.matchMethod,
      matchConfidence: a.matchConfidence,
      guestNameFromSignals: guestName,
      createdAt: a.createdAt.toISOString(),
    };
  });

  console.log(
    JSON.stringify(
      {
        auditedAt: new Date().toISOString(),
        upcomingAirbnbCount: upcoming.length,
        guestNameDistribution: byGuestName,
        placeholderUpcoming: placeholderUpcoming.map((r) => ({
          id: r.id,
          guestName: r.guestName,
          code: r.reservationCode,
          property: r.property.name,
          org: r.property.organization.name,
          checkIn: r.checkIn.toISOString().slice(0, 10),
          checkOut: r.checkOut.toISOString().slice(0, 10),
          icalUid: r.icalUid?.slice(0, 40),
          emailEvents: r.emailEvents.map((e) => ({
            kind: e.eventKind,
            method: e.matchMethod,
            confidence: e.matchConfidence,
            enrichedGuestName:
              e.enrichedFields &&
              typeof e.enrichedFields === "object" &&
              !Array.isArray(e.enrichedFields)
                ? e.enrichedFields.guestName ?? null
                : null,
            createdAt: e.createdAt.toISOString(),
          })),
        })),
        recentAuditsForAffectedProperties: auditSummary,
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
