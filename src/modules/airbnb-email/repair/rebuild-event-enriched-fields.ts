import { AirbnbEmailEventKind } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { mergeEnrichedFieldsForEmailEvent } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { buildStructuredMetadataFields } from "@/modules/airbnb-email/matching/reservation-match-persist";
import type { ExtractedReservationSignals } from "@/modules/airbnb-email/types";

function readSignalsFromAuditPayload(payload: unknown): ExtractedReservationSignals | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const signals = root.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return null;
  return signals as ExtractedReservationSignals;
}

export function computeEnrichedFieldsFromAuditSignals(input: {
  signals: ExtractedReservationSignals;
  eventKind: AirbnbEmailEventKind;
}): Record<string, string | number> {
  const metadataFields = buildStructuredMetadataFields(input.signals);
  return mergeEnrichedFieldsForEmailEvent({
    reservationEnrichedFields: {},
    metadataFields,
    signals: input.signals,
    eventKind: input.eventKind,
  });
}

export type RebuildEventEnrichedFieldsResult =
  | { status: "applied"; enrichedFieldKeys: string[] }
  | { status: "skipped"; reason: string };

export async function rebuildEventEnrichedFieldsFromAudit(input: {
  auditId: string;
}): Promise<RebuildEventEnrichedFieldsResult> {
  const audit = await db.emailIngestionAudit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      classification: true,
      parsedPayload: true,
      reservationEvent: { select: { id: true } },
    },
  });

  if (!audit?.reservationEvent) {
    return { status: "skipped", reason: "audit_or_event_missing" };
  }
  if (!audit.classification) {
    return { status: "skipped", reason: "audit_classification_missing" };
  }

  const signals = readSignalsFromAuditPayload(audit.parsedPayload);
  if (!signals) {
    return { status: "skipped", reason: "audit_signals_missing" };
  }

  const enrichedFields = computeEnrichedFieldsFromAuditSignals({
    signals,
    eventKind: audit.classification,
  });
  const enrichedFieldKeys = Object.keys(enrichedFields);
  if (enrichedFieldKeys.length === 0) {
    return { status: "skipped", reason: "no_enriched_fields" };
  }

  await db.reservationEmailEvent.update({
    where: { id: audit.reservationEvent.id },
    data: { enrichedFields },
  });

  airbnbEmailLog.info("linkage_event_enriched_fields_rebuilt", {
    auditId: input.auditId,
    eventId: audit.reservationEvent.id,
    enrichedFieldKeys: enrichedFieldKeys.join(","),
  });

  return { status: "applied", enrichedFieldKeys };
}
