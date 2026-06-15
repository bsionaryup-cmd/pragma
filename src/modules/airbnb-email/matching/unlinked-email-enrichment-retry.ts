import {
  AirbnbEmailEventKind,
  AirbnbEmailMatchMethod,
  AirbnbEmailProcessingStatus,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { attemptDelayedEnrichmentRetry } from "@/modules/airbnb-email/matching/delayed-enrichment-retry";

const RESERVATION_EVENT_KINDS: AirbnbEmailEventKind[] = [
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
];

export type UnlinkedEmailEnrichmentRetryResult = {
  scanned: number;
  linked: number;
  skipped: number;
  noMatch: number;
};

async function loadRetryableAuditIds(input: {
  propertyId?: string;
  organizationId?: string;
  limit: number;
  lookbackHours: number;
}): Promise<Array<{ id: string; organizationId: string | null; propertyId: string | null }>> {
  const since = new Date(Date.now() - input.lookbackHours * 60 * 60 * 1000);

  return db.emailIngestionAudit.findMany({
    where: {
      reservationId: null,
      propertyId: input.propertyId ? input.propertyId : { not: null },
      organizationId: input.organizationId ? input.organizationId : { not: null },
      classification: { in: RESERVATION_EVENT_KINDS },
      processingStatus: {
        in: [
          AirbnbEmailProcessingStatus.PROCESSED,
          AirbnbEmailProcessingStatus.MANUAL_REVIEW,
        ],
      },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: input.limit,
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
    },
  });
}

/**
 * Reintenta vincular y enriquecer correos Airbnb ya clasificados pero sin reserva.
 * Usado tras sync iCal y por cron (durable, no depende de setTimeout en serverless).
 */
export async function retryUnlinkedAuditsForProperty(input: {
  propertyId: string;
  organizationId?: string | null;
  limit?: number;
  lookbackHours?: number;
}): Promise<UnlinkedEmailEnrichmentRetryResult> {
  const limit = input.limit ?? 12;
  const lookbackHours = input.lookbackHours ?? 24 * 14;

  const audits = await loadRetryableAuditIds({
    propertyId: input.propertyId,
    organizationId: input.organizationId ?? undefined,
    limit,
    lookbackHours,
  });

  if (audits.length === 0) {
    return { scanned: 0, linked: 0, skipped: 0, noMatch: 0 };
  }

  airbnbEmailLog.info("unlinked_email_retry_property_start", {
    propertyId: input.propertyId,
    organizationId: input.organizationId ?? undefined,
    auditCount: audits.length,
  });

  let linked = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const audit of audits) {
    const organizationId = audit.organizationId ?? input.organizationId;
    if (!organizationId) {
      skipped += 1;
      continue;
    }

    const result = await attemptDelayedEnrichmentRetry({
      auditId: audit.id,
      organizationId,
      propertyId: audit.propertyId ?? input.propertyId,
    });

    if (result.status === "success") linked += 1;
    else if (result.status === "skipped") skipped += 1;
    else noMatch += 1;
  }

  airbnbEmailLog.info("unlinked_email_retry_property_done", {
    propertyId: input.propertyId,
    scanned: audits.length,
    linked,
    skipped,
    noMatch,
  });

  return { scanned: audits.length, linked, skipped, noMatch };
}

export async function runUnlinkedEmailEnrichmentRetryJob(input?: {
  limit?: number;
  lookbackHours?: number;
}): Promise<UnlinkedEmailEnrichmentRetryResult> {
  const limit = input?.limit ?? 40;
  const lookbackHours = input?.lookbackHours ?? 24 * 14;

  const audits = await loadRetryableAuditIds({ limit, lookbackHours });

  airbnbEmailLog.info("unlinked_email_retry_job_start", {
    auditCount: audits.length,
    lookbackHours,
  });

  let linked = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const audit of audits) {
    if (!audit.organizationId) {
      skipped += 1;
      continue;
    }

    const result = await attemptDelayedEnrichmentRetry({
      auditId: audit.id,
      organizationId: audit.organizationId,
      propertyId: audit.propertyId,
    });

    if (result.status === "success") linked += 1;
    else if (result.status === "skipped") skipped += 1;
    else noMatch += 1;
  }

  airbnbEmailLog.info("unlinked_email_retry_job_done", {
    scanned: audits.length,
    linked,
    skipped,
    noMatch,
  });

  return { scanned: audits.length, linked, skipped, noMatch };
}
