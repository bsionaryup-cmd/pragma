import {
  AirbnbEmailEventKind,
  AirbnbEmailMatchMethod,
  AirbnbEmailProcessingStatus,
  AirbnbEmailTaskKind,
  Prisma,
} from "@prisma/client";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import {
  persistReservationCommunication,
  isCommunicationEventKind,
} from "@/modules/airbnb-email/domains/communication.domain";
import {
  persistReservationPayout,
  isFinancialEventKind,
} from "@/modules/airbnb-email/domains/financial.domain";
import {
  persistReservationReview,
  isReputationEventKind,
} from "@/modules/airbnb-email/domains/reputation.domain";
import { isReservationEventKind } from "@/modules/airbnb-email/domains/reservation-event.domain";
import { persistReservationMatchLinkage } from "@/modules/airbnb-email/matching/reservation-match-persist";
import {
  createEmailDerivedTask,
  createTasksForEmailEvent,
} from "@/modules/airbnb-email/domains/task.domain";
import { scheduleDelayedEnrichmentRetry } from "@/modules/airbnb-email/matching/delayed-enrichment-retry";
import { matchReservationFromEmailSignals } from "@/modules/airbnb-email/matching/reservation-matcher";
import {
  allowTrustedForwardedAirbnbEmail,
  extractEmailAddress,
  isForwardedEmail,
  isLikelyAirbnbSender,
  shouldProcessAirbnbEmail,
} from "@/modules/airbnb-email/lib/sender-guard";
import {
  assertAirbnbEmailIntegrationEnabled,
  assertPropertyInOrganization,
  assertReservationInOrganization,
} from "@/modules/airbnb-email/lib/tenant-guard";
import { applyMatchPolicy } from "@/modules/airbnb-email/lib/match-policy";
import { toPersistedMatchMethod } from "@/modules/airbnb-email/lib/match-method-persistence";
import {
  buildEmailBody,
  extractReservationSignals,
  hashEmailContent,
} from "@/modules/airbnb-email/parsing/extractors";
import { buildAuditRawEmailPayload } from "@/modules/airbnb-email/parsing/audit-raw-email";
import { classifyAirbnbEmail } from "@/modules/airbnb-email/router/airbnb-email-router";
import type {
  EmailProcessingOutcome,
  InboundAirbnbEmailPayload,
  ProcessInboundEmailOptions,
  SafeCommunicationIntent,
} from "@/modules/airbnb-email/types";

function logEmailProcessingTerminal(input: {
  event: "email_processing_completed" | "email_processing_failed";
  stage: string;
  reason: string;
  auditId: string | null;
  organizationId: string | null;
  auditPersisted: boolean;
  reservationLinked: boolean;
  duplicateDetected: boolean;
}): void {
  const payload = {
    stage: input.stage,
    reason: input.reason,
    auditId: input.auditId ?? undefined,
    organizationId: input.organizationId ?? undefined,
    auditPersisted: input.auditPersisted,
    reservationLinked: input.reservationLinked,
    duplicateDetected: input.duplicateDetected,
  };
  if (input.event === "email_processing_failed") {
    airbnbEmailLog.error(input.event, payload);
    return;
  }
  airbnbEmailLog.info(input.event, payload);
}

export async function processInboundAirbnbEmail(
  payload: InboundAirbnbEmailPayload,
  options?: ProcessInboundEmailOptions,
): Promise<EmailProcessingOutcome> {
  const organizationId = options?.organizationId ?? null;

  if (organizationId) {
    await assertAirbnbEmailIntegrationEnabled(organizationId);
  }

  const bodyPreview = buildEmailBody(payload);
  const fromAddress = extractEmailAddress(payload.from);
  const directAirbnbSender = isLikelyAirbnbSender(payload.from);
  const forwarded = isForwardedEmail(payload.subject, bodyPreview);
  const trustedForward = allowTrustedForwardedAirbnbEmail(
    payload.subject,
    bodyPreview,
  );
  const shouldProcess = shouldProcessAirbnbEmail({
    from: payload.from,
    subject: payload.subject,
    body: bodyPreview,
  });

  if (!shouldProcess) {
    if (forwarded || (!directAirbnbSender && !trustedForward)) {
      airbnbEmailLog.warn("forward_rejected", {
        from: fromAddress,
        subject: payload.subject.slice(0, 120),
        forwarded,
        trustedForward,
        organizationId,
      });
    } else {
      airbnbEmailLog.warn("ignored_non_airbnb_sender", {
        from: fromAddress,
        organizationId,
      });
    }
    logEmailProcessingTerminal({
      event: "email_processing_completed",
      stage: "sender_guard",
      reason: "ignored_non_airbnb_or_untrusted_forward",
      auditId: null,
      organizationId,
      auditPersisted: false,
      reservationLinked: false,
      duplicateDetected: false,
    });
    return { auditId: "", status: "ignored" };
  }

  if (forwarded && !directAirbnbSender) {
    airbnbEmailLog.info("forward_detected", {
      from: fromAddress,
      subject: payload.subject.slice(0, 120),
      organizationId,
    });
    airbnbEmailLog.info("forward_airbnb_validated", {
      from: fromAddress,
      organizationId,
    });
  }

  if (options?.propertyId && organizationId) {
    await assertPropertyInOrganization(options.propertyId, organizationId);
  }

  const body = bodyPreview;
  const contentHash = hashEmailContent({
    messageId: payload.messageId,
    from: payload.from,
    subject: payload.subject,
    body,
    organizationId,
  });

  const duplicateWhere: Prisma.EmailIngestionAuditWhereInput = {
    OR: [
      ...(payload.messageId?.trim()
        ? [{ messageId: payload.messageId.trim() }]
        : []),
      { contentHash },
    ],
    ...(organizationId ? { organizationId } : {}),
  };

  const existing = await db.emailIngestionAudit.findFirst({
    where: duplicateWhere,
    select: { id: true },
  });

  if (existing) {
    airbnbEmailLog.info("skipped_duplicate", {
      auditId: existing.id,
      messageId: payload.messageId ?? undefined,
      organizationId,
    });
    logEmailProcessingTerminal({
      event: "email_processing_completed",
      stage: "duplicate_guard",
      reason: "skipped_duplicate",
      auditId: existing.id,
      organizationId,
      auditPersisted: true,
      reservationLinked: false,
      duplicateDetected: true,
    });
    return {
      auditId: existing.id,
      status: "skipped_duplicate",
    };
  }

  const classified = classifyAirbnbEmail({
    from: payload.from,
    subject: payload.subject,
    body,
  });
  const signals = extractReservationSignals({
    subject: payload.subject,
    body,
    html: payload.html,
  });
  const parsedPayload = {
    classified,
    signals,
    receivedAt: payload.receivedAt ?? new Date().toISOString(),
  };

  if (signals.confirmationCode) {
    airbnbEmailLog.info("confirmation_code_extracted", {
      organizationId: organizationId ?? undefined,
      confirmationCode: signals.confirmationCode,
      source: "normalized_reservation_context",
    });
  }

  airbnbEmailLog.info("inbound_received", {
    subject: payload.subject.slice(0, 120),
    eventKind: classified.eventKind,
    organizationId,
    from: extractEmailAddress(payload.from),
  });

  airbnbEmailLog.info("parser_extracted", {
    organizationId,
    confirmationCode: signals.confirmationCode ?? undefined,
    airbnbRoomId: signals.airbnbRoomId ?? undefined,
    unitNumber: signals.unitNumber ?? undefined,
    listingName: signals.listingName?.slice(0, 80) ?? undefined,
    guestNamePresent: Boolean(signals.guestName),
    guestName: signals.guestName?.slice(0, 60) ?? undefined,
    guestEmailPresent: Boolean(signals.guestEmail),
    guestPhonePresent: Boolean(signals.guestPhone),
    guestCount: signals.guestCount ?? undefined,
    checkIn: signals.checkIn ?? undefined,
    checkOut: signals.checkOut ?? undefined,
    hasAmount:
      signals.grossAmount != null ||
      signals.netPayout != null ||
      signals.hostFee != null,
    currency: signals.currency ?? undefined,
    extractionPreview: body.slice(0, 220).replace(/\s+/g, " "),
  });

  if (classified.eventKind === AirbnbEmailEventKind.UNKNOWN) {
    airbnbEmailLog.info("classified_unknown", {
      subject: payload.subject.slice(0, 120),
      organizationId,
    });
  }

  let audit;
  try {
    audit = await db.emailIngestionAudit.create({
      data: {
        messageId: payload.messageId?.trim() || null,
        contentHash,
        fromAddress: payload.from,
        toAddress: payload.to ?? null,
        subject: payload.subject,
        senderChannel: classified.senderChannel,
        rawEmail: buildAuditRawEmailPayload(payload),
        classification: classified.eventKind,
        processingStatus: AirbnbEmailProcessingStatus.CLASSIFIED,
        parsedPayload,
        organizationId,
        propertyId: options?.propertyId ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await db.emailIngestionAudit.findFirst({
        where: duplicateWhere,
        select: { id: true },
      });
      if (raced) {
        airbnbEmailLog.info("skipped_duplicate_race", {
          auditId: raced.id,
          organizationId,
        });
        logEmailProcessingTerminal({
          event: "email_processing_completed",
          stage: "duplicate_guard",
          reason: "skipped_duplicate_race",
          auditId: raced.id,
          organizationId,
          auditPersisted: true,
          reservationLinked: false,
          duplicateDetected: true,
        });
        return { auditId: raced.id, status: "skipped_duplicate" };
      }
    }
    throw error;
  }

  try {
    let match = await matchReservationFromEmailSignals(signals, {
      propertyId: options?.propertyId,
      organizationId,
      listingAmbiguous: options?.listingAmbiguous,
    });

    if (match.reservationId && organizationId) {
      try {
        await assertReservationInOrganization(
          match.reservationId,
          organizationId,
        );
      } catch {
        airbnbEmailLog.warn("cross_tenant_block", {
          auditId: audit.id,
          reservationId: match.reservationId,
          organizationId,
        });
        match = applyMatchPolicy(
          {
            reservationId: null,
            propertyId: match.propertyId,
            organizationId,
            method: AirbnbEmailMatchMethod.NONE,
            confidence: 0,
          },
          { hasConfirmationCodeInEmail: Boolean(signals.confirmationCode) },
        );
      }
    }

    airbnbEmailLog.info("matched", {
      auditId: audit.id,
      reservationId: match.reservationId,
      method: match.method,
      confidence: match.confidence,
      tier: match.tier,
      manualReview: match.requiresManualReview,
      organizationId,
    });
    if (match.method === AirbnbEmailMatchMethod.NONE) {
      airbnbEmailLog.warn("match_none_inputs", {
        auditId: audit.id,
        hasConfirmationCode: Boolean(signals.confirmationCode),
        hasAirbnbRoomId: Boolean(signals.airbnbRoomId),
        hasListingName: Boolean(signals.listingName),
        hasGuestName: Boolean(signals.guestName),
        hasCheckIn: Boolean(signals.checkIn),
        hasCheckOut: Boolean(signals.checkOut),
        providedPropertyId: Boolean(options?.propertyId),
        listingAmbiguous: Boolean(options?.listingAmbiguous),
        organizationId,
      });
    }

    let communicationIntent: SafeCommunicationIntent | null = null;

    if (match.reservationId) {
      try {
        await persistReservationMatchLinkage({
          auditId: audit.id,
          match,
          eventKind: classified.eventKind,
          signals,
          payload: parsedPayload,
          organizationId,
          propertyId: match.propertyId ?? options?.propertyId ?? null,
        });
      } catch (persistError) {
        airbnbEmailLog.error("reservation_match_persist_failed", {
          auditId: audit.id,
          reservationId: match.reservationId,
          error:
            persistError instanceof Error
              ? persistError.message
              : "Error desconocido",
          stack:
            persistError instanceof Error ? persistError.stack : undefined,
        });
        throw persistError;
      }
    } else {
      const unresolvedPropertyId =
        match.propertyId ?? options?.propertyId ?? null;
      await db.emailIngestionAudit.update({
        where: { id: audit.id },
        data: {
          reservationId: null,
          propertyId: unresolvedPropertyId,
          organizationId: match.organizationId ?? organizationId,
          matchMethod: toPersistedMatchMethod(match.method),
          matchConfidence: match.confidence,
        },
      });

      if (
        isReservationEventKind(classified.eventKind) &&
        organizationId &&
        unresolvedPropertyId
      ) {
        airbnbEmailLog.info("no_safe_candidate_found", {
          auditId: audit.id,
          propertyId: unresolvedPropertyId,
          organizationId,
        });
        airbnbEmailLog.info("automatic_reconciliation_retry", {
          auditId: audit.id,
          organizationId,
          propertyId: unresolvedPropertyId,
          retryDelaysSeconds: "30,120,300",
        });
        scheduleDelayedEnrichmentRetry({
          auditId: audit.id,
          organizationId,
          propertyId: unresolvedPropertyId,
        });
      }
    }

    if (isFinancialEventKind(classified.eventKind)) {
      await persistReservationPayout({
        auditId: audit.id,
        match,
        signals,
        payload: parsedPayload,
      });
    }

    if (isCommunicationEventKind(classified.eventKind)) {
      communicationIntent = await persistReservationCommunication({
        auditId: audit.id,
        match,
        messageBody: signals.messageBody ?? body,
        payload: parsedPayload,
      });
    }

    if (isReputationEventKind(classified.eventKind)) {
      await persistReservationReview({
        auditId: audit.id,
        eventKind: classified.eventKind,
        match,
        signals,
        payload: parsedPayload,
      });
    }

    if (options?.listingAmbiguous) {
      await createEmailDerivedTask({
        auditId: audit.id,
        kind: AirbnbEmailTaskKind.MANUAL_REVIEW,
        title: "Listing ambiguo en correo Airbnb",
        description: payload.subject,
        match,
      });
    }

    await createTasksForEmailEvent({
      auditId: audit.id,
      eventKind: classified.eventKind,
      match,
      communicationIntent,
    });

    const finalStatus = match.requiresManualReview
      ? AirbnbEmailProcessingStatus.MANUAL_REVIEW
      : AirbnbEmailProcessingStatus.PROCESSED;

    await db.emailIngestionAudit.update({
      where: { id: audit.id },
      data: {
        processingStatus: finalStatus,
        processedAt: new Date(),
      },
    });

    airbnbEmailLog.info("processed", {
      auditId: audit.id,
      status: finalStatus,
      eventKind: classified.eventKind,
      reservationId: match.reservationId,
    });
    logEmailProcessingTerminal({
      event: "email_processing_completed",
      stage: "pipeline_finalized",
      reason: match.requiresManualReview ? "manual_review" : "processed",
      auditId: audit.id,
      organizationId,
      auditPersisted: true,
      reservationLinked: Boolean(match.reservationId),
      duplicateDetected: false,
    });

    return {
      auditId: audit.id,
      status: match.requiresManualReview ? "manual_review" : "processed",
      eventKind: classified.eventKind,
      reservationId: match.reservationId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";

    await db.emailIngestionAudit.update({
      where: { id: audit.id },
      data: {
        processingStatus: AirbnbEmailProcessingStatus.FAILED,
        errorReason: message,
        processedAt: new Date(),
      },
    });

    airbnbEmailLog.error("process_failed", {
      auditId: audit.id,
      error: message,
      organizationId,
    });
    logEmailProcessingTerminal({
      event: "email_processing_failed",
      stage: "pipeline_failed",
      reason: message,
      auditId: audit.id,
      organizationId,
      auditPersisted: true,
      reservationLinked: false,
      duplicateDetected: false,
    });

    await createEmailDerivedTask({
      auditId: audit.id,
      kind: AirbnbEmailTaskKind.MANUAL_REVIEW,
      title: "Error procesando correo Airbnb",
      description: message,
      match: {
        reservationId: null,
        propertyId: options?.propertyId ?? null,
        organizationId,
        method: AirbnbEmailMatchMethod.NONE,
        confidence: 0,
        tier: "low",
        requiresManualReview: true,
        allowReservationEnrichment: false,
      },
    }).catch(() => undefined);

    return {
      auditId: audit.id,
      status: "failed",
      errorReason: message,
    };
  }
}
