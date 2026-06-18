import "server-only";

import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import { buildEmailBody, extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";
import { recordReservationActivityFromInboundEmail } from "@/modules/reservation-activity/services/record-activity-from-email";
import type { RecordActivityFromEmailInput } from "@/modules/reservation-activity/types";
import type { AirbnbEmailEventKind } from "@prisma/client";

/**
 * Garantiza que un correo auditado también tenga fila en reservation_activity
 * (requerido para Novedades). Idempotente.
 */
export async function ensureReservationActivityFromInboundEmail(
  input: RecordActivityFromEmailInput,
): Promise<void> {
  if (!input.auditId?.trim()) return;

  const [existingActivity, existingPending] = await Promise.all([
    db.reservationActivity.findUnique({
      where: { sourceEmailId: input.auditId },
      select: { id: true, activityType: true },
    }),
    db.reservationActivityPending.findUnique({
      where: { sourceEmailId: input.auditId },
      select: { id: true },
    }),
  ]);

  if (existingActivity || existingPending) return;

  await recordReservationActivityFromInboundEmail(input).catch((error) => {
    airbnbEmailLog.warn("reservation_activity_failed", {
      auditId: input.auditId,
      reservationId: input.reservationId ?? undefined,
      error: error instanceof Error ? error.message : "unknown",
    });
  });
}

export async function ensureReservationActivityFromAuditRow(input: {
  organizationId: string;
  auditId: string;
  reservationId: string | null;
  propertyId: string | null;
  subject: string;
  from: string;
  html?: string | null;
  text?: string | null;
  receivedAt?: string | null;
  pipelineEventKind?: AirbnbEmailEventKind | null;
}): Promise<void> {
  const bodyPreview = buildEmailBody({
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  const signals = extractReservationSignals({
    subject: input.subject,
    body: bodyPreview,
    html: input.html,
  });

  await ensureReservationActivityFromInboundEmail({
    organizationId: input.organizationId,
    auditId: input.auditId,
    reservationId: input.reservationId,
    propertyId: input.propertyId,
    subject: input.subject,
    html: input.html,
    text: input.text,
    from: input.from,
    signals,
    pipelineEventKind: input.pipelineEventKind ?? null,
    receivedAt: input.receivedAt,
  });
}
