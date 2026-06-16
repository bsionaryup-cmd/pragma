import { randomUUID } from "node:crypto";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { invalidateLivePmsCaches } from "@/lib/live-pms-refresh";
import { db } from "@/lib/db";
import { applyFinancialBackfill } from "@/modules/airbnb-email/repair/apply-financial-backfill";
import { applyGuestNameToPlaceholderReservation } from "@/modules/airbnb-email/repair/apply-guest-name-placeholder";
import { rebuildEventEnrichedFieldsFromAudit } from "@/modules/airbnb-email/repair/rebuild-event-enriched-fields";
import {
  findLinkageConflictCandidates,
  relinkIdsOnly,
} from "@/modules/airbnb-email/repair/relink-ids-only";
import {
  assignReservationCodeFillEmpty,
  resolveLinkageTargetReservation,
} from "@/modules/airbnb-email/repair/resolve-linkage-target";

export type RunAirbnbEmailLinkageRepairResult = {
  runId: string;
  scanned: number;
  relocated: number;
  skipped: number;
  codesAssigned: number;
  enrichedRebuilt: number;
  financialBackfilled: number;
  guestNamesApplied: number;
  details: Array<{
    eventId: string;
    fromReservationId: string;
    toReservationId?: string;
    status: string;
    reason?: string;
  }>;
};

export async function runAirbnbEmailLinkageRepairJob(input?: {
  organizationId?: string;
  dryRun?: boolean;
  runId?: string;
}): Promise<RunAirbnbEmailLinkageRepairResult> {
  const runId = input?.runId ?? randomUUID();
  const dryRun = input?.dryRun ?? false;

  airbnbEmailLog.info("linkage_repair_job_started", {
    runId,
    dryRun,
    organizationId: input?.organizationId,
  });

  const candidates = await findLinkageConflictCandidates({
    organizationId: input?.organizationId,
  });

  const result: RunAirbnbEmailLinkageRepairResult = {
    runId,
    scanned: candidates.length,
    relocated: 0,
    skipped: 0,
    codesAssigned: 0,
    enrichedRebuilt: 0,
    financialBackfilled: 0,
    guestNamesApplied: 0,
    details: [],
  };

  const backfillReservationIds = new Set<string>();

  for (const candidate of candidates) {
    const audit = await db.emailIngestionAudit.findUnique({
      where: { id: candidate.auditId },
      select: { parsedPayload: true },
    });
    if (!audit) {
      result.skipped += 1;
      result.details.push({
        eventId: candidate.eventId,
        fromReservationId: candidate.fromReservationId,
        status: "skipped",
        reason: "audit_missing",
      });
      continue;
    }

    let target = await resolveLinkageTargetReservation({
      confirmationCode: candidate.confirmationCode,
      propertyId: candidate.propertyId,
      auditParsedPayload: audit.parsedPayload,
    });

    if (target.status === "unresolved" || target.status === "ambiguous") {
      result.skipped += 1;
      result.details.push({
        eventId: candidate.eventId,
        fromReservationId: candidate.fromReservationId,
        status: "skipped",
        reason:
          target.status === "ambiguous"
            ? `ambiguous_target:${target.candidateIds.join(",")}`
            : target.reason,
      });
      continue;
    }

    if (dryRun) {
      result.details.push({
        eventId: candidate.eventId,
        fromReservationId: candidate.fromReservationId,
        toReservationId: target.reservationId,
        status: "dry_run",
      });
      continue;
    }

    if (target.method === "placeholder_dates") {
      const assigned = await assignReservationCodeFillEmpty({
        runId,
        reservationId: target.reservationId,
        confirmationCode: candidate.confirmationCode,
        sourceAuditId: candidate.auditId,
      });
      if (assigned.status === "applied") {
        result.codesAssigned += 1;
      }
    }

    const relink = await relinkIdsOnly({
      runId,
      eventId: candidate.eventId,
      auditId: candidate.auditId,
      confirmationCode: candidate.confirmationCode,
      fromReservationId: candidate.fromReservationId,
      toReservationId: target.reservationId,
    });

    if (relink.status !== "applied") {
      result.skipped += 1;
      result.details.push({
        eventId: candidate.eventId,
        fromReservationId: candidate.fromReservationId,
        toReservationId: target.reservationId,
        status: relink.status,
        reason: relink.status === "skipped" || relink.status === "noop" ? relink.reason : undefined,
      });
      continue;
    }

    result.relocated += 1;
    backfillReservationIds.add(target.reservationId);

    const rebuilt = await rebuildEventEnrichedFieldsFromAudit({
      auditId: candidate.auditId,
    });
    if (rebuilt.status === "applied") {
      result.enrichedRebuilt += 1;
    }

    const guestName = await applyGuestNameToPlaceholderReservation({
      reservationId: target.reservationId,
      auditId: candidate.auditId,
      eventKind: candidate.eventKind,
    });
    if (guestName.status === "applied") {
      result.guestNamesApplied += 1;
    }

    result.details.push({
      eventId: candidate.eventId,
      fromReservationId: candidate.fromReservationId,
      toReservationId: target.reservationId,
      status: "relocated",
    });
  }

  if (!dryRun) {
    for (const reservationId of backfillReservationIds) {
      const backfill = await applyFinancialBackfill({ runId, reservationId });
      if (backfill.status === "applied") {
        result.financialBackfilled += 1;
      }
    }
    invalidateLivePmsCaches("reservation_linkage");
  }

  airbnbEmailLog.info("linkage_repair_job_done", {
    runId,
    dryRun,
    scanned: result.scanned,
    relocated: result.relocated,
    skipped: result.skipped,
    codesAssigned: result.codesAssigned,
    enrichedRebuilt: result.enrichedRebuilt,
    financialBackfilled: result.financialBackfilled,
    guestNamesApplied: result.guestNamesApplied,
  });

  return result;
}
