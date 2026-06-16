/**
 * Re-clasifica correos "Reserva confirmada" erróneamente como CANCELED
 * y aplica enriquecimiento a reservas con placeholder.
 *
 *   npx tsx scripts/reconcile-misclassified-airbnb-confirmations.ts [organizationId]
 */
import { config } from "dotenv";
import {
  AirbnbEmailEventKind,
  AirbnbEmailMatchMethod,
  BookingPlatform,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import {
  applySafeReservationEnrichment,
  isPlaceholderGuestName,
  mergeEnrichedFieldsForEmailEvent,
  splitGuestName,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import { toPersistedMatchMethod } from "@/modules/airbnb-email/lib/match-method-persistence";
import { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
import { classifyAirbnbEmail } from "@/modules/airbnb-email/router/airbnb-email-router";
import { buildEmailBody } from "@/modules/airbnb-email/parsing/extractors";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import { prismaDateToKey } from "@/lib/dates";

config();
config({ path: ".env.local", override: true });

const orgId = process.argv[2]?.trim() || "cmplxfg0a000105jrs0gqtwyc";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readSignals(audit: {
  parsedPayload: unknown;
}): ExtractedReservationSignals | null {
  if (
    !audit.parsedPayload ||
    typeof audit.parsedPayload !== "object" ||
    Array.isArray(audit.parsedPayload)
  ) {
    return null;
  }
  const signals = (audit.parsedPayload as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return null;
  }
  return signals as ExtractedReservationSignals;
}

function subjectLooksConfirmed(subject: string | null): boolean {
  return /reserva confirmada|booking confirmed|confirmed reservation/i.test(
    subject ?? "",
  );
}

async function findPlaceholderReservations(organizationId: string) {
  return db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      property: { organizationId },
      OR: [
        { guestName: { equals: "Huésped Airbnb", mode: "insensitive" } },
        { guestName: { equals: "Airbnb", mode: "insensitive" } },
        { guestName: { equals: "Reserved", mode: "insensitive" } },
        { guestName: { equals: "Reservado", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      guestName: true,
      propertyId: true,
      checkIn: true,
      checkOut: true,
    },
  });
}

async function main() {
  const misclassified = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: orgId,
      classification: AirbnbEmailEventKind.CANCELED,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      reservationId: true,
      propertyId: true,
      organizationId: true,
      parsedPayload: true,
      rawEmail: true,
    },
  });

  const candidates = misclassified.filter((a) => subjectLooksConfirmed(a.subject));
  const processedReservationIds = new Set<string>();
  const results: Array<Record<string, unknown>> = [];

  for (const audit of candidates) {
    const signals = readSignals(audit);
    if (!signals) {
      results.push({ auditId: audit.id, status: "skipped", reason: "no_signals" });
      continue;
    }

    let match = await matchReservationFromEmailSignals(signals, {
      organizationId: orgId,
      propertyId: audit.propertyId,
    });

    if (
      audit.reservationId &&
      (!match.reservationId || isPlaceholderGuestName(
        (
          await db.reservation.findUnique({
            where: { id: audit.reservationId },
            select: { guestName: true },
          })
        )?.guestName,
      ))
    ) {
      const linked = await db.reservation.findUnique({
        where: { id: audit.reservationId },
        select: { id: true, propertyId: true, guestName: true },
      });
      if (linked) {
        match = applyMatchPolicy(
          {
            reservationId: linked.id,
            propertyId: linked.propertyId,
            organizationId: orgId,
            method: AirbnbEmailMatchMethod.LISTING_DATES,
            confidence: 0.95,
          },
          { hasConfirmationCodeInEmail: Boolean(signals.confirmationCode) },
        );
      }
    }

    if (!match.reservationId || !match.allowReservationEnrichment) {
      results.push({
        auditId: audit.id,
        status: "no_match",
        subject: audit.subject?.slice(0, 80),
        guestName: signals.guestName,
        checkIn: signals.checkIn,
        checkOut: signals.checkOut,
      });
      continue;
    }

    if (processedReservationIds.has(match.reservationId)) {
      results.push({ auditId: audit.id, status: "skipped_duplicate_reservation" });
      continue;
    }

    const reservation = await db.reservation.findUnique({
      where: { id: match.reservationId },
      select: { guestName: true },
    });
    if (
      reservation?.guestName &&
      !isPlaceholderGuestName(reservation.guestName)
    ) {
      processedReservationIds.add(match.reservationId);
      results.push({
        auditId: audit.id,
        status: "already_enriched",
        reservationId: match.reservationId,
        guestName: reservation.guestName,
      });
      continue;
    }

    const enrichedFieldsRaw = await applySafeReservationEnrichment({
      match,
      signals,
      eventKind: AirbnbEmailEventKind.CONFIRMED,
      mode: "reservation",
    });

    const metadata: Record<string, string | number> = {};
    if (signals.guestCountTotal != null) metadata.guestCountTotal = signals.guestCountTotal;
    if (signals.adultCount != null) metadata.adultCount = signals.adultCount;
    if (signals.childCount != null) metadata.childCount = signals.childCount;
    if (signals.confirmationCode?.trim()) {
      metadata.reservationCode = signals.confirmationCode.trim();
    }

    const enrichedFields = mergeEnrichedFieldsForEmailEvent({
      reservationEnrichedFields: enrichedFieldsRaw,
      metadataFields: metadata,
      signals,
      eventKind: AirbnbEmailEventKind.CONFIRMED,
    });

    await db.$transaction(async (tx) => {
      await tx.emailIngestionAudit.update({
        where: { id: audit.id },
        data: {
          classification: AirbnbEmailEventKind.CONFIRMED,
          reservationId: match.reservationId,
          propertyId: match.propertyId ?? audit.propertyId,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
        },
      });

      await tx.reservationEmailEvent.upsert({
        where: { auditId: audit.id },
        update: {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          reservationId: match.reservationId!,
          enrichedFields: enrichedFields as Prisma.InputJsonValue,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
        },
        create: {
          auditId: audit.id,
          reservationId: match.reservationId!,
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: signals.confirmationCode ?? null,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
          payload: audit.parsedPayload as Prisma.InputJsonValue,
          enrichedFields: enrichedFields as Prisma.InputJsonValue,
        },
      });

      if (
        !enrichedFieldsRaw.guestName &&
        signals.guestName?.trim() &&
        isPlaceholderGuestName(reservation?.guestName)
      ) {
        const split = splitGuestName(signals.guestName);
        await tx.reservation.update({
          where: { id: match.reservationId! },
          data: {
            guestName: split.guestName,
            guestFirstName: split.guestFirstName,
            guestLastName: split.guestLastName,
          },
        });
      }
    });

    processedReservationIds.add(match.reservationId);
    results.push({
      auditId: audit.id,
      status: "enriched",
      reservationId: match.reservationId,
      guestName: enrichedFields.guestName ?? signals.guestName,
      subject: audit.subject?.slice(0, 80),
    });
  }

  const placeholders = await findPlaceholderReservations(orgId);
  const stillPlaceholder = placeholders.filter((p) => !processedReservationIds.has(p.id));

  console.log(
    JSON.stringify(
      {
        organizationId: orgId,
        misclassifiedAuditsScanned: candidates.length,
        enriched: results.filter((r) => r.status === "enriched"),
        noMatch: results.filter((r) => r.status === "no_match"),
        alreadyEnriched: results.filter((r) => r.status === "already_enriched"),
        stillPlaceholder: stillPlaceholder.map((p) => ({
          id: p.id,
          checkIn: prismaDateToKey(p.checkIn),
          checkOut: prismaDateToKey(p.checkOut),
          guestName: p.guestName,
        })),
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
