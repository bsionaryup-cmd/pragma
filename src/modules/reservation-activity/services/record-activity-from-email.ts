import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { buildEmailBody } from "@/modules/airbnb-email/parsing/extractors";
import { resolveActivityCaptureType } from "@/modules/reservation-activity/classifiers/activity-email-classifier";
import { buildActivityContent } from "@/modules/reservation-activity/parsing/activity-content-build";
import {
  persistReservationActivity,
  resolvePropertyIdForActivity,
} from "@/modules/reservation-activity/services/persist-reservation-activity";
import {
  deletePendingActivityBySourceEmailId,
  persistReservationActivityPending,
} from "@/modules/reservation-activity/services/persist-reservation-activity-pending";
import type { RecordActivityFromEmailInput } from "@/modules/reservation-activity/types";

/**
 * Read-only timeline hook. Never mutates reservations, calendar, or automations.
 * Matched emails → reservation_activity. Unmatched → reservation_activity_pending.
 */
export async function recordReservationActivityFromInboundEmail(
  input: RecordActivityFromEmailInput,
): Promise<{
  recorded: boolean;
  pending?: boolean;
  activityType?: string;
  activityId?: string;
}> {
  if (!input.auditId?.trim()) {
    return { recorded: false };
  }

  const body = buildEmailBody({
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  const { activityType, confidence } = resolveActivityCaptureType({
    subject: input.subject,
    body,
    messageBody: input.signals?.messageBody,
    pipelineEventKind: input.pipelineEventKind ?? null,
  });

  airbnbEmailLog.info("reservation_activity_classified", {
    auditId: input.auditId,
    reservationId: input.reservationId ?? undefined,
    rawSubject: input.subject.slice(0, 240),
    activityType,
    confidence,
    matched: Boolean(input.reservationId),
  });

  const built = buildActivityContent({
    activityType,
    subject: input.subject,
    body,
    from: input.from,
    signals: input.signals,
    confidence,
  });

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : null;
  const createdAt =
    receivedAt && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null;

  if (!input.reservationId?.trim()) {
    const pendingResult = await persistReservationActivityPending({
      organizationId: input.organizationId,
      propertyId: input.propertyId ?? null,
      activityType,
      title: built.title,
      content: built.content,
      sourceEmailId: input.auditId,
      rawSubject: input.subject,
      senderName: built.senderName,
      senderEmail: built.senderEmail,
      metadata: built.metadata,
      classificationConfidence: confidence,
      createdAt,
    });

    if (pendingResult.created) {
      airbnbEmailLog.info("reservation_activity_pending_recorded", {
        auditId: input.auditId,
        activityType,
        confidence,
        pendingId: pendingResult.id,
        organizationId: input.organizationId ?? undefined,
        propertyId: input.propertyId ?? undefined,
      });
    } else {
      airbnbEmailLog.info("reservation_activity_pending_duplicate_skipped", {
        auditId: input.auditId,
        activityType,
        pendingId: pendingResult.id,
      });
    }

    return {
      recorded: pendingResult.created,
      pending: true,
      activityType,
      activityId: pendingResult.id,
    };
  }

  await deletePendingActivityBySourceEmailId(input.auditId);

  const propertyId = await resolvePropertyIdForActivity({
    reservationId: input.reservationId,
    propertyId: input.propertyId ?? null,
  });

  const result = await persistReservationActivity({
    reservationId: input.reservationId,
    propertyId,
    activityType,
    title: built.title,
    content: built.content,
    sourceEmailId: input.auditId,
    senderName: built.senderName,
    senderEmail: built.senderEmail,
    metadata: built.metadata,
    createdAt,
  });

  if (result.created) {
    airbnbEmailLog.info("reservation_activity_recorded", {
      auditId: input.auditId,
      reservationId: input.reservationId,
      activityType,
      confidence,
      activityId: result.id,
      propertyId: propertyId ?? undefined,
    });
  } else {
    airbnbEmailLog.info("reservation_activity_duplicate_skipped", {
      auditId: input.auditId,
      reservationId: input.reservationId,
      activityType,
      activityId: result.id,
    });
  }

  return {
    recorded: result.created,
    pending: false,
    activityType,
    activityId: result.id,
  };
}
