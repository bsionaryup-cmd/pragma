import { AirbnbEmailMatchMethod } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { isReservationEventKind } from "@/modules/airbnb-email/domains/reservation-event.domain";
import { isPlaceholderGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import {
  persistReservationMatchLinkage,
  reapplyReservationEnrichmentFromAudit,
} from "@/modules/airbnb-email/matching/reservation-match-persist";
import { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

const RETRY_DELAYS_MS = [30_000, 120_000, 300_000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasMeaningfulEnrichedFields(enrichedFields: unknown): boolean {
  if (!enrichedFields || typeof enrichedFields !== "object" || Array.isArray(enrichedFields)) {
    return false;
  }
  const fields = enrichedFields as Record<string, unknown>;
  const guestName =
    typeof fields.guestName === "string" ? fields.guestName.trim() : "";
  return Boolean(
    (guestName && !isPlaceholderGuestName(guestName)) ||
      fields.guestCountTotal != null ||
      fields.guestTotalPaid != null ||
      fields.hostPayoutAmount != null ||
      (typeof fields.reservationCode === "string" && fields.reservationCode.trim()),
  );
}

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

  const reservation = await db.reservation.findFirst({
    where: {
      id: input.auditReservationId,
      property: { organizationId: input.organizationId },
    },
    select: {
      id: true,
      propertyId: true,
      reservationCode: true,
      guestName: true,
    },
  });

  if (!reservation) return input.match;

  const emailCode = input.signals.confirmationCode?.trim();
  const dbCode = reservation.reservationCode?.trim();
  if (emailCode && dbCode && emailCode === dbCode) {
    return applyMatchPolicy(
      {
        reservationId: reservation.id,
        propertyId: reservation.propertyId ?? input.propertyId,
        organizationId: input.organizationId,
        method: AirbnbEmailMatchMethod.CONFIRMATION_CODE,
        confidence: 0.95,
      },
      { hasConfirmationCodeInEmail: Boolean(emailCode) },
    );
  }

  return input.match;
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
      reservationEvent: {
        select: { enrichedFields: true },
      },
    },
  });

  if (!audit) {
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

  if (
    audit.reservationId &&
    hasMeaningfulEnrichedFields(audit.reservationEvent?.enrichedFields)
  ) {
    airbnbEmailLog.info("retry_enrichment_skipped", {
      auditId: audit.id,
      reason: "already_enriched",
      reservationId: audit.reservationId,
    });
    return { status: "skipped" };
  }

  let match = await matchReservationFromEmailSignals(signals, {
    propertyId,
    organizationId,
  });

  if (audit.reservationId) {
    match = await boostMatchForLinkedAudit({
      auditReservationId: audit.reservationId,
      propertyId,
      organizationId,
      signals,
      match,
    });
  }

  if (!match.reservationId || !match.allowReservationEnrichment) {
    return { status: "no_match" };
  }

  const eventKind = audit.classification;
  if (!eventKind || !isReservationEventKind(eventKind)) {
    return { status: "no_match" };
  }

  const persistInput = {
    auditId: audit.id,
    match,
    eventKind,
    signals,
    payload: audit.parsedPayload as object,
    organizationId,
    propertyId: match.propertyId ?? propertyId,
  };

  const persistResult = audit.reservationId
    ? await reapplyReservationEnrichmentFromAudit(persistInput)
    : await persistReservationMatchLinkage(persistInput);

  if (!persistResult || persistResult.enrichedFieldKeys.length === 0) {
    return { status: "no_match" };
  }

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
