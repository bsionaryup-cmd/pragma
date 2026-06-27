import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { invalidateLivePmsCaches } from "@/lib/live-pms-refresh";
import { applySafeReservationEnrichment, mergeEnrichedFieldsForEmailEvent } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import {
  applyEmailCancellationForMatchedReservation,
  isReservationEventKind,
} from "@/modules/airbnb-email/domains/reservation-event.domain";
import { toPersistedMatchMethod } from "@/modules/airbnb-email/lib/match-method-persistence";
import { refreshAuditSignalsFromRaw } from "@/modules/airbnb-email/repair/refresh-audit-signals-from-raw";
import type {
  ExtractedReservationSignals,
  ReservationMatchResult,
} from "@/modules/airbnb-email/types";

export type PersistReservationMatchInput = {
  auditId: string;
  match: ReservationMatchResult;
  eventKind: AirbnbEmailEventKind;
  signals: ExtractedReservationSignals;
  payload: Prisma.InputJsonValue;
  organizationId: string | null;
  propertyId: string | null;
};

export type PersistReservationMatchResult = {
  linkedAuditCount: number;
  reservationEmailEventCount: number;
  enrichedFieldKeys: string[];
};

export function buildStructuredMetadataFields(
  signals: ExtractedReservationSignals,
): Record<string, string | number> {
  const metadata: Record<string, string | number> = {};
  if (signals.guestCountTotal != null) metadata.guestCountTotal = signals.guestCountTotal;
  if (signals.adultCount != null) metadata.adultCount = signals.adultCount;
  if (signals.childCount != null) metadata.childCount = signals.childCount;
  if (signals.infantCount != null) metadata.infantCount = signals.infantCount;
  if (signals.petCount != null) metadata.petCount = signals.petCount;
  if (signals.guestTotalPaid != null) metadata.guestTotalPaid = signals.guestTotalPaid;
  if (signals.hostPayoutAmount != null) metadata.hostPayoutAmount = signals.hostPayoutAmount;
  if (signals.currency?.trim()) metadata.currency = signals.currency.trim();
  if (signals.nightCount != null) metadata.nightCount = signals.nightCount;
  return metadata;
}

async function resolveEnrichmentSignalsFromAudit(
  auditId: string,
  signals: ExtractedReservationSignals,
): Promise<ExtractedReservationSignals> {
  const audit = await db.emailIngestionAudit.findUnique({
    where: { id: auditId },
    select: { parsedPayload: true, rawEmail: true, subject: true },
  });
  if (!audit) return signals;
  return (
    refreshAuditSignalsFromRaw({
      parsedPayload: audit.parsedPayload ?? { signals },
      rawEmail: audit.rawEmail,
      subject: audit.subject,
    }) ?? signals
  );
}

export async function reapplyReservationEnrichmentFromAudit(
  input: PersistReservationMatchInput,
): Promise<PersistReservationMatchResult | null> {
  if (!input.match.reservationId || !input.match.allowReservationEnrichment) return null;
  const persistedMatchMethod = toPersistedMatchMethod(input.match.method);
  const signals = await resolveEnrichmentSignalsFromAudit(input.auditId, input.signals);

  const reservationEnrichedFields = await applySafeReservationEnrichment({
    match: input.match,
    signals,
    eventKind: input.eventKind,
    mode: "reservation",
  });
  const metadataFields = buildStructuredMetadataFields(signals);
  const enrichedFields = mergeEnrichedFieldsForEmailEvent({
    reservationEnrichedFields,
    metadataFields,
    signals,
    eventKind: input.eventKind,
  });
  const enrichedFieldKeys = Object.keys(enrichedFields);
  if (enrichedFieldKeys.length === 0) {
    return {
      linkedAuditCount: 1,
      reservationEmailEventCount: 1,
      enrichedFieldKeys: [],
    };
  }

  const result = await db.$transaction(async (tx) => {
    await tx.emailIngestionAudit.update({
      where: { id: input.auditId },
      data: {
        reservationId: input.match.reservationId,
        propertyId: input.match.propertyId ?? input.propertyId,
        organizationId: input.match.organizationId ?? input.organizationId,
        matchMethod: persistedMatchMethod,
        matchConfidence: input.match.confidence,
      },
    });

    await tx.reservationEmailEvent.upsert({
      where: { auditId: input.auditId },
      update: {
        reservationId: input.match.reservationId,
        eventKind: input.eventKind,
        confirmationCode: signals.confirmationCode,
        matchMethod: persistedMatchMethod,
        matchConfidence: input.match.confidence,
        enrichedFields,
      },
      create: {
        auditId: input.auditId,
        reservationId: input.match.reservationId,
        eventKind: input.eventKind,
        confirmationCode: signals.confirmationCode,
        matchMethod: persistedMatchMethod,
        matchConfidence: input.match.confidence,
        payload: input.payload,
        enrichedFields,
      },
    });

    const linkedAudits = await tx.emailIngestionAudit.count({
      where: { reservationId: input.match.reservationId! },
    });
    const linkedEvents = await tx.reservationEmailEvent.count({
      where: { reservationId: input.match.reservationId! },
    });

    return { linkedAudits, linkedEvents };
  });

  invalidateLivePmsCaches("reservation_linkage");

  airbnbEmailLog.info("reservation_enrichment_reapplied", {
    auditId: input.auditId,
    reservationId: input.match.reservationId,
    enrichedFieldCount: enrichedFieldKeys.length,
  });

  return {
    linkedAuditCount: result.linkedAudits,
    reservationEmailEventCount: result.linkedEvents,
    enrichedFieldKeys,
  };
}

export async function persistReservationMatchLinkage(
  input: PersistReservationMatchInput,
): Promise<PersistReservationMatchResult | null> {
  if (!input.match.reservationId) return null;
  const persistedMatchMethod = toPersistedMatchMethod(input.match.method);

  airbnbEmailLog.info("reservation_match_persist_started", {
    auditId: input.auditId,
    reservationId: input.match.reservationId,
    propertyId: input.propertyId ?? input.match.propertyId ?? undefined,
    matchMethod: input.match.method,
    persistedMatchMethod,
    matchConfidence: input.match.confidence,
  });

  try {
    const signals = await resolveEnrichmentSignalsFromAudit(
      input.auditId,
      input.signals,
    );
    const result = await db.$transaction(async (tx) => {
      await tx.emailIngestionAudit.update({
        where: { id: input.auditId },
        data: {
          reservationId: input.match.reservationId,
          propertyId: input.match.propertyId ?? input.propertyId,
          organizationId: input.match.organizationId ?? input.organizationId,
          matchMethod: persistedMatchMethod,
          matchConfidence: input.match.confidence,
        },
      });

      let enrichedFieldKeys: string[] = [];
      if (isReservationEventKind(input.eventKind)) {
        airbnbEmailLog.info("reservation_enrichment_started", {
          auditId: input.auditId,
          reservationId: input.match.reservationId,
          eventKind: input.eventKind,
        });
        const reservationEnrichedFields = await applySafeReservationEnrichment({
          match: input.match,
          signals,
          eventKind: input.eventKind,
          mode: "reservation",
          tx,
        });
        const metadataFields = buildStructuredMetadataFields(signals);
        const enrichedFields = mergeEnrichedFieldsForEmailEvent({
          reservationEnrichedFields,
          metadataFields,
          signals,
          eventKind: input.eventKind,
        });
        enrichedFieldKeys = Object.keys(enrichedFields);

        const event = await tx.reservationEmailEvent.create({
          data: {
            auditId: input.auditId,
            reservationId: input.match.reservationId,
            eventKind: input.eventKind,
            confirmationCode: signals.confirmationCode,
            matchMethod: persistedMatchMethod,
            matchConfidence: input.match.confidence,
            payload: input.payload,
            enrichedFields:
              enrichedFieldKeys.length > 0 ? enrichedFields : undefined,
          },
        });

        airbnbEmailLog.info("reservation_email_event_created", {
          auditId: input.auditId,
          eventId: event.id,
          reservationId: input.match.reservationId,
          enrichedFieldCount: enrichedFieldKeys.length,
        });

        const persistedGuestName =
          (typeof enrichedFields.guestName === "string"
            ? enrichedFields.guestName
            : null) ??
          input.signals.guestName ??
          null;
        airbnbEmailLog.info("enrichment_guest_name_persist_check", {
          reservationId: input.match.reservationId,
          auditId: input.auditId,
          guestName: persistedGuestName ?? undefined,
          persisted: Boolean(persistedGuestName?.trim()),
        });
        airbnbEmailLog.info("reservation_enrichment_completed", {
          auditId: input.auditId,
          reservationId: input.match.reservationId,
          eventKind: input.eventKind,
          enrichedFieldKeys: enrichedFieldKeys.length,
        });
      }

      if (input.match.reservationId) {
        await applyEmailCancellationForMatchedReservation({
          eventKind: input.eventKind,
          reservationId: input.match.reservationId,
          auditId: input.auditId,
          tx,
        });
      }

      const linkedAudits = await tx.emailIngestionAudit.count({
        where: { reservationId: input.match.reservationId! },
      });
      const linkedEvents = await tx.reservationEmailEvent.count({
        where: { reservationId: input.match.reservationId! },
      });

      return { linkedAudits, linkedEvents, enrichedFieldKeys };
    });

    airbnbEmailLog.info("reservation_match_persist_success", {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      propertyId: input.propertyId ?? input.match.propertyId ?? undefined,
      linkedAuditCount: result.linkedAudits,
      reservationEmailEventCount: result.linkedEvents,
    });

    airbnbEmailLog.info("reservation_audit_linked", {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      propertyId: input.propertyId ?? input.match.propertyId ?? undefined,
      matchMethod: input.match.method,
      persistedMatchMethod,
    });

    airbnbEmailLog.info("reservation_link_created", {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      organizationId: input.match.organizationId ?? input.organizationId ?? undefined,
    });

    airbnbEmailLog.info("ui_enrichment_relation_verified", {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      propertyId: input.propertyId ?? input.match.propertyId ?? undefined,
      linkedAuditCount: result.linkedAudits,
      reservationEmailEventCount: result.linkedEvents,
    });

    if (result.enrichedFieldKeys.length > 0) {
      airbnbEmailLog.info("enrichment_applied", {
        auditId: input.auditId,
        reservationId: input.match.reservationId,
        fields: result.enrichedFieldKeys.join(","),
      });
    }

    invalidateLivePmsCaches("reservation_linkage");

    return {
      linkedAuditCount: result.linkedAudits,
      reservationEmailEventCount: result.linkedEvents,
      enrichedFieldKeys: result.enrichedFieldKeys,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const stack = error instanceof Error ? error.stack : undefined;
    airbnbEmailLog.error("reservation_match_persist_failed", {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      propertyId: input.propertyId ?? undefined,
      error: message,
      stack,
    });
    throw error;
  }
}
