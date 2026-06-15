/**
 * Auditoría forense pipeline enriquecimiento Airbnb.
 * node scripts/forensic-airbnb-enrichment-audit.mjs
 */
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingPlatform, Prisma } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = process.argv[2]?.trim() || "cmplxfg0a000105jrs0gqtwyc";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readRawProvider(rawEmail) {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) {
    return null;
  }
  const raw = rawEmail;
  return {
    provider: raw.provider ?? null,
    source: raw.source ?? null,
    eventType: raw.eventType ?? null,
    emailId: raw.emailId ?? null,
  };
}

function isForwardedFromAudit(audit) {
  const subject = audit.subject ?? "";
  const from = audit.fromAddress ?? "";
  const subjFwd = /^(?:fwd?|fw|rv|reenviado|re):/i.test(subject.trim());
  const fromNotAirbnb =
    !from.toLowerCase().includes("@airbnb.com") &&
    !from.toLowerCase().includes("automated@airbnb") &&
    !from.toLowerCase().includes("express@airbnb");
  return subjFwd || fromNotAirbnb;
}

function enrichedGuestName(enrichedFields) {
  if (!enrichedFields || typeof enrichedFields !== "object" || Array.isArray(enrichedFields)) {
    return null;
  }
  const name = enrichedFields.guestName;
  return typeof name === "string" ? name : null;
}

async function main() {
  const integration = await db.tenantAirbnbEmailIntegration.findUnique({
    where: { organizationId: ORG_ID },
    include: {
      organization: { select: { name: true } },
    },
  });

  const auditStats = await db.emailIngestionAudit.groupBy({
    by: ["classification"],
    where: { organizationId: ORG_ID },
    _count: true,
  });

  const auditByStatus = await db.emailIngestionAudit.groupBy({
    by: ["processingStatus"],
    where: { organizationId: ORG_ID },
    _count: true,
  });

  const totalAudits = await db.emailIngestionAudit.count({
    where: { organizationId: ORG_ID },
  });

  const forwardedCount = await db.$queryRaw`
    SELECT COUNT(*)::int AS count FROM email_ingestion_audit
    WHERE "organizationId" = ${ORG_ID}
    AND (
      subject ILIKE 'fwd:%' OR subject ILIKE 'fw:%' OR subject ILIKE 'reenviado:%'
      OR "fromAddress" NOT ILIKE '%@airbnb.com%'
    )
  `;

  const directAirbnbCount = await db.$queryRaw`
    SELECT COUNT(*)::int AS count FROM email_ingestion_audit
    WHERE "organizationId" = ${ORG_ID}
    AND "fromAddress" ILIKE '%@airbnb.com%'
    AND subject NOT ILIKE 'fwd:%' AND subject NOT ILIKE 'fw:%'
  `;

  const resendProviderCount = await db.$queryRaw`
    SELECT COUNT(*)::int AS count FROM email_ingestion_audit
    WHERE "organizationId" = ${ORG_ID}
    AND "rawEmail"::text ILIKE '%"provider":"resend"%'
  `;

  const reconcileSourceCount = await db.$queryRaw`
    SELECT COUNT(*)::int AS count FROM email_ingestion_audit
    WHERE "organizationId" = ${ORG_ID}
    AND "rawEmail"::text ILIKE '%inbound_reconcile%'
  `;

  // Last 50 enriched: reservation with non-placeholder guest + email event with enrichedFields
  const enrichedEvents = await db.reservationEmailEvent.findMany({
    where: {
      reservation: {
        platform: BookingPlatform.AIRBNB,
        property: { organizationId: ORG_ID },
      },
      enrichedFields: { not: Prisma.DbNull },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      eventKind: true,
      createdAt: true,
      confirmationCode: true,
      matchMethod: true,
      enrichedFields: true,
      audit: {
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          toAddress: true,
          classification: true,
          processingStatus: true,
          createdAt: true,
          rawEmail: true,
          reservationId: true,
        },
      },
      reservation: {
        select: {
          id: true,
          guestName: true,
          reservationCode: true,
          createdAt: true,
          checkIn: true,
          checkOut: true,
          icalUid: true,
        },
      },
    },
  });

  const historicalEnriched = enrichedEvents
    .filter((e) => enrichedGuestName(e.enrichedFields))
    .map((e) => {
      const audit = e.audit;
      const provider = readRawProvider(audit?.rawEmail);
      const forwarded = audit ? isForwardedFromAudit(audit) : null;
      const reservationCreated = e.reservation?.createdAt;
      const auditCreated = audit?.createdAt;
      const deltaMs =
        reservationCreated && auditCreated
          ? auditCreated.getTime() - reservationCreated.getTime()
          : null;

      return {
        reservationId: e.reservation?.id,
        reservationCreatedAt: reservationCreated?.toISOString(),
        auditCreatedAt: auditCreated?.toISOString(),
        auditBeforeReservation: deltaMs != null ? deltaMs < 0 : null,
        deltaHours:
          deltaMs != null ? Math.round((deltaMs / 3_600_000) * 10) / 10 : null,
        guestNameEnriched: enrichedGuestName(e.enrichedFields),
        reservationGuestName: e.reservation?.guestName,
        confirmationCode: e.confirmationCode ?? e.reservation?.reservationCode,
        eventKind: e.eventKind,
        auditClassification: audit?.classification,
        auditSubject: audit?.subject?.slice(0, 100),
        fromAddress: audit?.fromAddress,
        toAddress: audit?.toAddress,
        forwarded,
        resendProvider: provider?.provider === "resend",
        ingestSource: provider?.source ?? (provider?.provider === "resend" ? "webhook" : "unknown"),
        matchMethod: e.matchMethod,
        checkIn: e.reservation?.checkIn?.toISOString().slice(0, 10),
        hasIcalUid: Boolean(e.reservation?.icalUid),
      };
    });

  // Placeholder / failed reservations
  const placeholders = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { not: "CANCELLED" },
      property: { organizationId: ORG_ID },
      OR: [
        { guestName: { equals: "Huésped Airbnb", mode: "insensitive" } },
        { guestName: { equals: "Airbnb", mode: "insensitive" } },
        { guestName: { equals: "Reserved", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
      icalUid: true,
      property: { select: { name: true, id: true } },
      emailEvents: {
        select: {
          eventKind: true,
          enrichedFields: true,
          createdAt: true,
          audit: {
            select: {
              id: true,
              subject: true,
              classification: true,
              createdAt: true,
              fromAddress: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const failedForensics = [];
  for (const r of placeholders) {
    const ci = r.checkIn.toISOString().slice(0, 10);
    const co = r.checkOut.toISOString().slice(0, 10);

    const matchingAudits = await db.emailIngestionAudit.findMany({
      where: {
        organizationId: ORG_ID,
        propertyId: r.property.id,
        OR: [
          { reservationId: r.id },
          {
            parsedPayload: {
              path: ["signals", "checkIn"],
              string_starts_with: ci,
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        subject: true,
        classification: true,
        reservationId: true,
        createdAt: true,
        fromAddress: true,
        processingStatus: true,
        parsedPayload: true,
      },
    });

    const auditsByDates = await db.emailIngestionAudit.findMany({
      where: { organizationId: ORG_ID, propertyId: r.property.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        subject: true,
        classification: true,
        reservationId: true,
        createdAt: true,
        parsedPayload: true,
      },
    });

    const dateMatched = auditsByDates.filter((a) => {
      const signals =
        a.parsedPayload &&
        typeof a.parsedPayload === "object" &&
        !Array.isArray(a.parsedPayload)
          ? a.parsedPayload.signals
          : null;
      if (!signals || typeof signals !== "object") return false;
      const aci = signals.checkIn?.slice?.(0, 10);
      const aco = signals.checkOut?.slice?.(0, 10);
      return aci === ci && aco === co;
    });

    failedForensics.push({
      reservationId: r.id,
      property: r.property.name,
      checkIn: ci,
      checkOut: co,
      reservationCreatedAt: r.createdAt.toISOString(),
      icalUid: r.icalUid?.slice(0, 40),
      emailEventCount: r.emailEvents.length,
      emailEvents: r.emailEvents.map((ev) => ({
        kind: ev.eventKind,
        enrichedGuest: enrichedGuestName(ev.enrichedFields),
        auditSubject: ev.audit?.subject?.slice(0, 80),
        auditClassification: ev.audit?.classification,
      })),
      linkedAudits: matchingAudits.length,
      dateMatchedAudits: dateMatched.slice(0, 3).map((a) => ({
        id: a.id,
        classification: a.classification,
        subject: a.subject?.slice(0, 80),
        reservationId: a.reservationId,
        createdAt: a.createdAt.toISOString(),
        guestNameFromSignals:
          a.parsedPayload?.signals?.guestName ?? null,
      })),
      chainBreak: (() => {
        if (r.emailEvents.length === 0 && dateMatched.length === 0) {
          return "NO_AUDIT_IN_DB — correo nunca ingresó a PRAGMA para estas fechas";
        }
        if (dateMatched.some((a) => a.classification === "CANCELED")) {
          return "MISCLASSIFIED_AS_CANCELED — confirmación clasificada como cancelación";
        }
        if (dateMatched.length > 0 && r.emailEvents.length === 0) {
          return "AUDIT_EXISTS_NO_EMAIL_EVENT — audit sin reservationEmailEvent";
        }
        if (r.emailEvents.length > 0 && !r.emailEvents.some((e) => enrichedGuestName(e.enrichedFields))) {
          return "EMAIL_EVENT_WITHOUT_ENRICHMENT — evento sin guestName en enrichedFields";
        }
        return "UNKNOWN";
      })(),
    });
  }

  const lastAudit = await db.emailIngestionAudit.findFirst({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, subject: true, classification: true },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    organizationId: ORG_ID,
    organizationName: integration?.organization?.name,
    integration: integration
      ? {
          enabled: integration.enabled,
          inboundEmailAddress: integration.inboundEmailAddress,
          lastEmailReceivedAt: integration.lastEmailReceivedAt?.toISOString(),
          lastProcessedAt: integration.lastProcessedAt?.toISOString(),
          syncStatus: integration.syncStatus,
        }
      : null,
    auditTotals: {
      total: totalAudits,
      byClassification: auditStats,
      byProcessingStatus: auditByStatus,
      forwardedOrNonAirbnbFrom: forwardedCount[0]?.count ?? 0,
      directAirbnbFrom: directAirbnbCount[0]?.count ?? 0,
      resendWebhookInRaw: resendProviderCount[0]?.count ?? 0,
      inboundReconcileSource: reconcileSourceCount[0]?.count ?? 0,
    },
    lastAuditInDb: lastAudit,
    historicalEnrichedCount: historicalEnriched.length,
    historicalEnriched,
    failedReservations: failedForensics,
    summary: {
      forwardedPct:
        totalAudits > 0
          ? Math.round(((forwardedCount[0]?.count ?? 0) / totalAudits) * 100)
          : 0,
      enrichedWithForwardedAudit: historicalEnriched.filter((h) => h.forwarded).length,
      enrichedWithDirectAirbnb: historicalEnriched.filter((h) => !h.forwarded).length,
    },
  };

  const outPath = "scripts/forensic-airbnb-enrichment-report.json";
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
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
