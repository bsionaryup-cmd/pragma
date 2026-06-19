import { randomUUID } from "node:crypto";
import {
  AirbnbEmailEventKind,
  AirbnbEmailMatchMethod,
  Prisma,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { invalidateLivePmsCaches } from "@/lib/live-pms-refresh";
import { db } from "@/lib/db";
import {
  applySafeReservationEnrichment,
  isPlaceholderGuestName,
  isZeroReservationAmount,
  mergeEnrichedFieldsForEmailEvent,
  pickReservationAmount,
  splitGuestName,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { subjectLooksLikeConfirmedReservation } from "@/modules/airbnb-email/lib/subject-markers";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import { toPersistedMatchMethod } from "@/modules/airbnb-email/lib/match-method-persistence";
import { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
import { applyFinancialBackfill } from "@/modules/airbnb-email/repair/apply-financial-backfill";
import {
  hasAuthoritativeHostFinancialSignals,
  refreshAuditSignalsFromRaw,
} from "@/modules/airbnb-email/repair/refresh-audit-signals-from-raw";
import { assignReservationCodeFillEmpty } from "@/modules/airbnb-email/repair/resolve-linkage-target";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

export type MisclassifiedConfirmationRepairDetail = {
  auditId: string;
  reservationId?: string;
  status:
    | "repaired"
    | "skipped"
    | "no_match"
    | "no_signals"
    | "duplicate_reservation";
  reason?: string;
  amount?: number;
};

export type RunMisclassifiedConfirmationRepairResult = {
  runId: string;
  scanned: number;
  repaired: number;
  financialBackfilled: number;
  codesAssigned: number;
  skipped: number;
  details: MisclassifiedConfirmationRepairDetail[];
};

async function boostMatchForLinkedAudit(input: {
  auditReservationId: string;
  propertyId: string | null;
  organizationId: string;
  signals: ExtractedReservationSignals;
  match: Awaited<ReturnType<typeof matchReservationFromEmailSignals>>;
}): Promise<Awaited<ReturnType<typeof matchReservationFromEmailSignals>>> {
  if (
    input.match.reservationId === input.auditReservationId &&
    input.match.allowReservationEnrichment
  ) {
    return input.match;
  }

  const linked = await db.reservation.findFirst({
    where: {
      id: input.auditReservationId,
      property: { organizationId: input.organizationId },
    },
    select: { id: true, propertyId: true, guestName: true },
  });
  if (!linked) return input.match;

  return applyMatchPolicy(
    {
      reservationId: linked.id,
      propertyId: linked.propertyId ?? input.propertyId,
      organizationId: input.organizationId,
      method: AirbnbEmailMatchMethod.LISTING_DATES,
      confidence: 0.95,
    },
    { hasConfirmationCodeInEmail: Boolean(input.signals.confirmationCode?.trim()) },
  );
}

function pickBestAuditByPayout<
  T extends { id: string; parsedPayload: unknown; rawEmail: unknown; subject: string | null },
>(audits: T[]): T | null {
  let best: { audit: T; amount: number } | null = null;
  for (const audit of audits) {
    const signals = refreshAuditSignalsFromRaw({
      parsedPayload: audit.parsedPayload,
      rawEmail: audit.rawEmail,
      subject: audit.subject,
    });
    const amount = signals ? pickReservationAmount(signals) : null;
    if (amount == null || amount <= 0) continue;
    if (!best || amount > best.amount) {
      best = { audit, amount };
    }
  }
  return best?.audit ?? audits[0] ?? null;
}

export async function runMisclassifiedConfirmationRepairJob(input?: {
  organizationId?: string;
  limit?: number;
  runId?: string;
  dryRun?: boolean;
}): Promise<RunMisclassifiedConfirmationRepairResult> {
  const runId = input?.runId ?? randomUUID();
  const limit = input?.limit ?? 80;
  const orgId = input?.organizationId?.trim();
  const dryRun = input?.dryRun ?? false;

  airbnbEmailLog.info("misclassified_confirmation_repair_started", {
    runId,
    organizationId: orgId,
    limit,
    dryRun,
  });

  const misclassified = await db.emailIngestionAudit.findMany({
    where: {
      classification: AirbnbEmailEventKind.CANCELED,
      ...(orgId ? { organizationId: orgId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
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

  const candidates = misclassified.filter((audit) =>
    subjectLooksLikeConfirmedReservation(audit.subject),
  );

  const byReservation = new Map<string, typeof candidates>();
  const unmatched: typeof candidates = [];

  for (const audit of candidates) {
    const reservationId = audit.reservationId?.trim();
    if (reservationId) {
      const list = byReservation.get(reservationId) ?? [];
      list.push(audit);
      byReservation.set(reservationId, list);
    } else {
      unmatched.push(audit);
    }
  }

  const result: RunMisclassifiedConfirmationRepairResult = {
    runId,
    scanned: candidates.length,
    repaired: 0,
    financialBackfilled: 0,
    codesAssigned: 0,
    skipped: 0,
    details: [],
  };

  const processedReservationIds = new Set<string>();

  async function repairAudit(audit: (typeof candidates)[number]): Promise<void> {
    const signals = refreshAuditSignalsFromRaw({
      parsedPayload: audit.parsedPayload,
      rawEmail: audit.rawEmail,
      subject: audit.subject,
    });
    if (!signals) {
      result.skipped += 1;
      result.details.push({ auditId: audit.id, status: "no_signals" });
      return;
    }

    let match = await matchReservationFromEmailSignals(signals, {
      organizationId: audit.organizationId,
      propertyId: audit.propertyId,
    });

    if (audit.reservationId) {
      match = await boostMatchForLinkedAudit({
        auditReservationId: audit.reservationId,
        propertyId: audit.propertyId,
        organizationId: audit.organizationId,
        signals,
        match,
      });
    }

    if (!match.reservationId || !match.allowReservationEnrichment) {
      result.skipped += 1;
      result.details.push({
        auditId: audit.id,
        status: "no_match",
        reason: "reservation_unresolved",
      });
      return;
    }

    if (processedReservationIds.has(match.reservationId)) {
      result.skipped += 1;
      result.details.push({
        auditId: audit.id,
        reservationId: match.reservationId,
        status: "duplicate_reservation",
      });
      return;
    }

    const reservation = await db.reservation.findUnique({
      where: { id: match.reservationId },
      select: {
        guestName: true,
        totalAmount: true,
        reservationCode: true,
        status: true,
      },
    });
    if (!reservation) {
      result.skipped += 1;
      result.details.push({
        auditId: audit.id,
        status: "skipped",
        reason: "reservation_not_found",
      });
      return;
    }

    const needsGuestRepair =
      !reservation.guestName?.trim() ||
      isPlaceholderGuestName(reservation.guestName);
    const needsFinancialRepair = isZeroReservationAmount(reservation.totalAmount);
    const needsCodeRepair = !reservation.reservationCode?.trim();
    const hasFinancialSignals = hasAuthoritativeHostFinancialSignals(signals);

    if (!needsGuestRepair && !needsFinancialRepair && !needsCodeRepair) {
      result.skipped += 1;
      result.details.push({
        auditId: audit.id,
        reservationId: match.reservationId,
        status: "skipped",
        reason: "reservation_already_complete",
      });
      return;
    }

    if (needsFinancialRepair && !hasFinancialSignals) {
      result.skipped += 1;
      result.details.push({
        auditId: audit.id,
        reservationId: match.reservationId,
        status: "skipped",
        reason: "no_financial_signals_in_email",
      });
      return;
    }

    if (dryRun) {
      processedReservationIds.add(match.reservationId);
      result.repaired += 1;
      result.details.push({
        auditId: audit.id,
        reservationId: match.reservationId,
        status: "repaired",
        amount: pickReservationAmount(signals) ?? undefined,
        reason: "dry_run",
      });
      return;
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

    const refreshedPayload = {
      ...(audit.parsedPayload && typeof audit.parsedPayload === "object"
        ? (audit.parsedPayload as Record<string, unknown>)
        : {}),
      signals,
    };

    await db.$transaction(async (tx) => {
      await tx.emailIngestionAudit.update({
        where: { id: audit.id },
        data: {
          classification: AirbnbEmailEventKind.CONFIRMED,
          reservationId: match.reservationId,
          propertyId: match.propertyId ?? audit.propertyId,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
          parsedPayload: refreshedPayload as Prisma.InputJsonValue,
        },
      });

      await tx.reservationEmailEvent.upsert({
        where: { auditId: audit.id },
        update: {
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          reservationId: match.reservationId!,
          confirmationCode: signals.confirmationCode ?? null,
          enrichedFields: enrichedFields as Prisma.InputJsonValue,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
          payload: refreshedPayload as Prisma.InputJsonValue,
        },
        create: {
          auditId: audit.id,
          reservationId: match.reservationId!,
          eventKind: AirbnbEmailEventKind.CONFIRMED,
          confirmationCode: signals.confirmationCode ?? null,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
          payload: refreshedPayload as Prisma.InputJsonValue,
          enrichedFields: enrichedFields as Prisma.InputJsonValue,
        },
      });

      if (
        needsGuestRepair &&
        signals.guestName?.trim() &&
        isPlaceholderGuestName(reservation.guestName)
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

    if (needsCodeRepair && signals.confirmationCode?.trim()) {
      const assigned = await assignReservationCodeFillEmpty({
        runId,
        reservationId: match.reservationId,
        confirmationCode: signals.confirmationCode,
        sourceAuditId: audit.id,
      });
      if (assigned.status === "applied") {
        result.codesAssigned += 1;
      }
    }

    const backfill = await applyFinancialBackfill({
      runId,
      reservationId: match.reservationId,
    });

    processedReservationIds.add(match.reservationId);
    result.repaired += 1;
    if (backfill.status === "applied") {
      result.financialBackfilled += 1;
    }

    result.details.push({
      auditId: audit.id,
      reservationId: match.reservationId,
      status: "repaired",
      amount: backfill.status === "applied" ? backfill.amount : pickReservationAmount(signals) ?? undefined,
    });
  }

  for (const [, audits] of byReservation) {
    const audit = pickBestAuditByPayout(audits);
    if (audit) await repairAudit(audit);
  }

  for (const audit of unmatched.slice(0, limit)) {
    await repairAudit(audit);
  }

  if (!dryRun && result.repaired > 0) {
    invalidateLivePmsCaches("reservation_linkage");
  }

  airbnbEmailLog.info("misclassified_confirmation_repair_done", {
    runId,
    scanned: result.scanned,
    repaired: result.repaired,
    financialBackfilled: result.financialBackfilled,
    codesAssigned: result.codesAssigned,
    skipped: result.skipped,
  });

  return result;
}
