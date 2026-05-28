import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { isReservationEventKind } from "@/modules/airbnb-email/domains/reservation-event.domain";
import { persistReservationMatchLinkage } from "@/modules/airbnb-email/matching/reservation-match-persist";
import { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

const RETRY_DELAYS_MS = [30_000, 60_000, 120_000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSignalsFromAuditPayload(payload: unknown): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const signals = root.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

export type DelayedEnrichmentRetryInput = {
  auditId: string;
  organizationId: string;
  propertyId: string | null;
};

export async function attemptDelayedEnrichmentRetry(
  input: DelayedEnrichmentRetryInput,
): Promise<{ status: "success" | "skipped" | "no_match" }> {
  airbnbEmailLog.info("retry_enrichment_executed", {
    auditId: input.auditId,
    organizationId: input.organizationId,
    propertyId: input.propertyId ?? undefined,
  });

  const audit = await db.emailIngestionAudit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      reservationId: true,
      propertyId: true,
      organizationId: true,
      classification: true,
      parsedPayload: true,
    },
  });

  if (!audit) {
    return { status: "skipped" };
  }

  if (audit.reservationId) {
    airbnbEmailLog.info("retry_enrichment_skipped", {
      auditId: audit.id,
      reason: "already_linked",
      reservationId: audit.reservationId,
    });
    return { status: "skipped" };
  }

  const signals = readSignalsFromAuditPayload(audit.parsedPayload);
  if (!signals) {
    return { status: "skipped" };
  }

  const propertyId = input.propertyId ?? audit.propertyId;
  const organizationId = input.organizationId ?? audit.organizationId;
  if (!organizationId) {
    return { status: "skipped" };
  }

  const match = await matchReservationFromEmailSignals(signals, {
    propertyId,
    organizationId,
  });

  if (!match.reservationId || !match.allowReservationEnrichment) {
    return { status: "no_match" };
  }

  const eventKind = audit.classification;
  if (!eventKind || !isReservationEventKind(eventKind)) {
    return { status: "no_match" };
  }

  await persistReservationMatchLinkage({
    auditId: audit.id,
    match,
    eventKind,
    signals,
    payload: audit.parsedPayload as object,
    organizationId,
    propertyId: match.propertyId ?? propertyId,
  });

  airbnbEmailLog.info("retry_enrichment_success", {
    auditId: audit.id,
    reservationId: match.reservationId,
    method: match.method,
    confidence: match.confidence,
  });

  return { status: "success" };
}

export function scheduleDelayedEnrichmentRetry(input: DelayedEnrichmentRetryInput): void {
  airbnbEmailLog.info("retry_enrichment_scheduled", {
    auditId: input.auditId,
    organizationId: input.organizationId,
    propertyId: input.propertyId ?? undefined,
    delaysMs: RETRY_DELAYS_MS.join(","),
  });

  void (async () => {
    for (const delayMs of RETRY_DELAYS_MS) {
      await sleep(delayMs);
      try {
        const result = await attemptDelayedEnrichmentRetry(input);
        if (result.status === "success" || result.status === "skipped") {
          return;
        }
      } catch (error) {
        airbnbEmailLog.warn("retry_enrichment_failed", {
          auditId: input.auditId,
          delayMs,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  })();
}
