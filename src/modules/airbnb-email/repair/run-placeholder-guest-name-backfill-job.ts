import { randomUUID } from "node:crypto";
import { BookingPlatform, ReservationStatus, AirbnbEmailEventKind, AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { invalidateLivePmsCaches } from "@/lib/live-pms-refresh";
import { db } from "@/lib/db";
import { persistReservationMatchLinkage } from "@/modules/airbnb-email/matching/reservation-match-persist";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";
import {
  applyPlaceholderGuestNameBackfill,
  CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME,
  resolveTrustworthyGuestNameForPlaceholder,
} from "@/modules/airbnb-email/repair/placeholder-guest-name-backfill";

export type PlaceholderGuestNameBackfillDetail = {
  reservationId: string;
  guestName: string;
  source: "email_event" | "ingestion_audit";
  checkIn: string;
  reservationCode: string | null;
};

export type RunPlaceholderGuestNameBackfillResult = {
  runId: string;
  scanned: number;
  applied: number;
  skipped: number;
  details: PlaceholderGuestNameBackfillDetail[];
};

function readAuditSignals(payload: unknown): ExtractedReservationSignals {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const signals = (payload as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return {};
  return signals as ExtractedReservationSignals;
}

function parseDateKey(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function datesOverlap(
  checkInA: Date,
  checkOutA: Date,
  checkInB: Date,
  checkOutB: Date,
): boolean {
  return checkInA < checkOutB && checkOutA > checkInB;
}

async function tryLinkUniqueOrphanConfirmationAudit(input: {
  reservationId: string;
  propertyId: string;
  organizationId: string;
  checkIn: Date;
  checkOut: Date;
  reservationCode: string | null;
  dryRun?: boolean;
}): Promise<boolean> {
  const orphanAudits = await db.emailIngestionAudit.findMany({
    where: {
      reservationId: null,
      classification: AirbnbEmailEventKind.CONFIRMED,
      OR: [
        { propertyId: input.propertyId },
        { organizationId: input.organizationId },
      ],
    },
    select: {
      id: true,
      parsedPayload: true,
      propertyId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const matches = orphanAudits.filter((audit) => {
    const signals = readAuditSignals(audit.parsedPayload);
    const auditCheckIn = parseDateKey(signals.checkIn);
    const auditCheckOut = parseDateKey(signals.checkOut);
    if (!auditCheckIn || !auditCheckOut) return false;
    if (!datesOverlap(input.checkIn, input.checkOut, auditCheckIn, auditCheckOut)) {
      return false;
    }
    if (
      input.reservationCode &&
      signals.confirmationCode?.trim() &&
      signals.confirmationCode.trim() !== input.reservationCode
    ) {
      return false;
    }
    return Boolean(signals.guestName?.trim());
  });

  if (matches.length !== 1) return false;

  const audit = matches[0]!;
  const signals = readAuditSignals(audit.parsedPayload);
  if (input.dryRun) return true;

  await persistReservationMatchLinkage({
    auditId: audit.id,
    match: {
      reservationId: input.reservationId,
      propertyId: input.propertyId,
      organizationId: input.organizationId,
      method: AirbnbEmailMatchMethod.LISTING_DATES,
      confidence: 0.9,
      tier: "high",
      requiresManualReview: false,
      allowReservationEnrichment: true,
    },
    eventKind: AirbnbEmailEventKind.CONFIRMED,
    signals,
    payload: (audit.parsedPayload ?? { signals }) as object,
    organizationId: input.organizationId,
    propertyId: input.propertyId,
  });

  return true;
}

/** Copia nombres confiables de enrichment al row cuando guestName sigue en placeholder canónico. */
export async function runPlaceholderGuestNameBackfillJob(input?: {
  organizationId?: string;
  limit?: number;
  runId?: string;
  dryRun?: boolean;
}): Promise<RunPlaceholderGuestNameBackfillResult> {
  const runId = input?.runId ?? randomUUID();
  const limit = input?.limit ?? 80;
  const orgId = input?.organizationId?.trim();
  const dryRun = input?.dryRun ?? false;

  airbnbEmailLog.info("placeholder_guest_name_backfill_started", {
    runId,
    organizationId: orgId,
    limit,
    dryRun,
  });

  const candidates = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      guestName: CANONICAL_AIRBNB_PLACEHOLDER_GUEST_NAME,
      status: { not: ReservationStatus.CANCELLED },
      guestRegistrationCompletedAt: null,
      ...(orgId ? { property: { organizationId: orgId } } : {}),
    },
    select: {
      id: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      propertyId: true,
      property: { select: { organizationId: true } },
      emailEvents: {
        select: {
          eventKind: true,
          confirmationCode: true,
          enrichedFields: true,
          payload: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { checkIn: "desc" },
    take: limit,
  });

  const result: RunPlaceholderGuestNameBackfillResult = {
    runId,
    scanned: candidates.length,
    applied: 0,
    skipped: 0,
    details: [],
  };

  for (const reservation of candidates) {
    if (
      reservation.emailEvents.length === 0 &&
      reservation.property.organizationId
    ) {
      const linked = await tryLinkUniqueOrphanConfirmationAudit({
        reservationId: reservation.id,
        propertyId: reservation.propertyId,
        organizationId: reservation.property.organizationId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        reservationCode: reservation.reservationCode,
        dryRun,
      });
      if (linked && !dryRun) {
        reservation.emailEvents = await db.reservationEmailEvent.findMany({
          where: { reservationId: reservation.id },
          select: {
            eventKind: true,
            confirmationCode: true,
            enrichedFields: true,
            payload: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    const linkedAudits =
      reservation.emailEvents.length === 0
        ? await db.emailIngestionAudit.findMany({
            where: { reservationId: reservation.id },
            select: { parsedPayload: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : [];

    const orphanAudits =
      reservation.emailEvents.length === 0 && linkedAudits.length === 0
        ? await db.emailIngestionAudit.findMany({
            where: {
              reservationId: null,
              classification: AirbnbEmailEventKind.CONFIRMED,
              OR: [
                { propertyId: reservation.propertyId },
                { organizationId: reservation.property.organizationId },
              ],
            },
            select: { parsedPayload: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : [];

    const resolved = resolveTrustworthyGuestNameForPlaceholder({
      emailEvents: reservation.emailEvents,
      reservationCode: reservation.reservationCode,
      auditPayloads: [
        ...linkedAudits.map((row) => row.parsedPayload),
        ...orphanAudits
          .filter((row) => {
            const signals = readAuditSignals(row.parsedPayload);
            const auditCheckIn = parseDateKey(signals.checkIn);
            const auditCheckOut = parseDateKey(signals.checkOut);
            if (!auditCheckIn || !auditCheckOut) return false;
            return datesOverlap(
              reservation.checkIn,
              reservation.checkOut,
              auditCheckIn,
              auditCheckOut,
            );
          })
          .map((row) => row.parsedPayload),
      ],
    });

    if (!resolved) {
      result.skipped += 1;
      continue;
    }

    await applyPlaceholderGuestNameBackfill({
      reservationId: reservation.id,
      guestName: resolved.guestName,
      dryRun,
    });

    result.applied += 1;
    result.details.push({
      reservationId: reservation.id,
      guestName: resolved.guestName,
      source: resolved.source,
      checkIn: reservation.checkIn.toISOString().slice(0, 10),
      reservationCode: reservation.reservationCode,
    });
  }

  if (!dryRun && result.applied > 0) {
    invalidateLivePmsCaches("reservation_linkage");
  }

  airbnbEmailLog.info("placeholder_guest_name_backfill_done", {
    runId,
    scanned: result.scanned,
    applied: result.applied,
    skipped: result.skipped,
    dryRun,
  });

  return result;
}
