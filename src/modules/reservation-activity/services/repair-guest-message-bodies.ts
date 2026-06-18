import { ReservationActivityType, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchResendReceivedEmail } from "@/modules/airbnb-email/integrations/resend-inbound.client";
import {
  buildEmailBody,
  extractReservationSignals,
} from "@/modules/airbnb-email/parsing/extractors";
import {
  readResendEmailIdFromAuditRaw,
} from "@/modules/airbnb-email/parsing/audit-raw-email";
import {
  isLikelyGuestMessageEmail,
  resolveActivityCaptureType,
} from "@/modules/reservation-activity/classifiers/activity-email-classifier";
import { buildActivityContent } from "@/modules/reservation-activity/parsing/activity-content-build";
import { resolveGuestMessageBodiesForDisplay } from "@/services/novedades/operational-feed.message";

export type GuestMessageRepairScope = {
  organizationId: string | null;
  userId: string;
};

const MIN_PARSEABLE_BODY_LEN = 120;

function reservationScopeWhere(
  scope: GuestMessageRepairScope,
): Prisma.ReservationWhereInput {
  if (scope.organizationId) {
    return { property: { organizationId: scope.organizationId } };
  }
  return { property: { ownerId: scope.userId } };
}

function readAuditEmailFields(rawEmail: unknown, subject: string) {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) {
    return { html: null as string | null, text: null as string | null, subject };
  }
  const record = rawEmail as Record<string, unknown>;
  return {
    html: typeof record.html === "string" ? record.html : null,
    text: typeof record.text === "string" ? record.text : null,
    subject: typeof record.subject === "string" ? record.subject : subject,
    from:
      typeof record.from === "string"
        ? record.from
        : null,
  };
}

async function resolveFullAuditEmailBody(audit: {
  id: string;
  subject: string;
  fromAddress: string;
  rawEmail: unknown;
}): Promise<{ html: string | null; text: string | null; subject: string; from: string }> {
  const stored = readAuditEmailFields(audit.rawEmail, audit.subject);
  let html = stored.html;
  let text = stored.text;

  const preview = buildEmailBody({
    subject: stored.subject,
    html,
    text,
  });

  if (preview.trim().length >= MIN_PARSEABLE_BODY_LEN) {
    return { html, text, subject: stored.subject, from: stored.from ?? audit.fromAddress };
  }

  const resendEmailId = readResendEmailIdFromAuditRaw(audit.rawEmail);
  if (!resendEmailId || !process.env.RESEND_API_KEY?.trim()) {
    return { html, text, subject: stored.subject, from: stored.from ?? audit.fromAddress };
  }

  try {
    const fetched = await fetchResendReceivedEmail(resendEmailId);
    html = fetched.html ?? html;
    text = fetched.text ?? text;

    await db.emailIngestionAudit.update({
      where: { id: audit.id },
      data: {
        rawEmail: {
          ...(typeof audit.rawEmail === "object" && audit.rawEmail && !Array.isArray(audit.rawEmail)
            ? (audit.rawEmail as Record<string, unknown>)
            : {}),
          from: fetched.from,
          to: fetched.to,
          subject: fetched.subject,
          html: fetched.html,
          text: fetched.text,
          emailId: resendEmailId,
          provider: "resend",
        },
      },
    });
  } catch {
    // keep stored values
  }

  return {
    html,
    text,
    subject: stored.subject,
    from: stored.from ?? audit.fromAddress,
  };
}

function activityParsesForDisplay(input: {
  content: string;
  metadataJson: unknown;
  guestName: string | null;
}): boolean {
  const metadata = input.metadataJson as { rawMessageBody?: string } | null;
  const source = metadata?.rawMessageBody?.trim() || input.content;
  return (
    resolveGuestMessageBodiesForDisplay(source, {
      guestName: input.guestName,
    }).length > 0
  );
}

export async function rebuildGuestMessageActivityFromAudit(
  auditId: string,
): Promise<boolean> {
  const audit = await db.emailIngestionAudit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      organizationId: true,
      reservationId: true,
      propertyId: true,
      subject: true,
      fromAddress: true,
      rawEmail: true,
      classification: true,
      createdAt: true,
    },
  });
  if (!audit?.reservationId) return false;

  const emailFields = await resolveFullAuditEmailBody(audit);
  const body = buildEmailBody({
    subject: emailFields.subject,
    html: emailFields.html,
    text: emailFields.text,
  });

  if (
    !isLikelyGuestMessageEmail({
      subject: audit.subject,
      body,
    })
  ) {
    return false;
  }

  const signals = extractReservationSignals({
    subject: audit.subject,
    body,
    html: emailFields.html,
  });

  const capture = resolveActivityCaptureType({
    subject: audit.subject,
    body,
    messageBody: signals.messageBody,
    pipelineEventKind: audit.classification,
  });

  if (capture.activityType === ReservationActivityType.UNMATCHED_AIRBNB) {
    capture.activityType = ReservationActivityType.AIRBNB_MESSAGE;
  }

  const built = buildActivityContent({
    activityType: ReservationActivityType.AIRBNB_MESSAGE,
    subject: audit.subject,
    body,
    from: emailFields.from,
    signals,
    confidence: capture.confidence,
  });

  const existing = await db.reservationActivity.findUnique({
    where: { sourceEmailId: auditId },
    select: { id: true },
  });

  if (existing) {
    await db.reservationActivity.update({
      where: { id: existing.id },
      data: {
        activityType: ReservationActivityType.AIRBNB_MESSAGE,
        title: built.title,
        content: built.content,
        senderName: built.senderName,
        senderEmail: built.senderEmail,
        metadataJson: built.metadata as Prisma.InputJsonValue,
      },
    });
  } else {
    await db.reservationActivity.create({
      data: {
        reservationId: audit.reservationId,
        propertyId: audit.propertyId,
        activityType: ReservationActivityType.AIRBNB_MESSAGE,
        title: built.title,
        content: built.content,
        sourceEmailId: auditId,
        senderName: built.senderName,
        senderEmail: built.senderEmail,
        metadataJson: built.metadata as Prisma.InputJsonValue,
        createdAt: audit.createdAt,
      },
    });
  }

  return activityParsesForDisplay({
    content: built.content,
    metadataJson: built.metadata,
    guestName: built.senderName,
  });
}

export async function repairUnparseableGuestMessageActivities(
  scope: GuestMessageRepairScope,
): Promise<number> {
  const activities = await db.reservationActivity.findMany({
    where: {
      sourceEmailId: { not: null },
      reservation: reservationScopeWhere(scope),
      activityType: {
        in: [
          ReservationActivityType.AIRBNB_MESSAGE,
          ReservationActivityType.UNMATCHED_AIRBNB,
        ],
      },
    },
    select: {
      id: true,
      sourceEmailId: true,
      content: true,
      metadataJson: true,
      senderName: true,
      activityType: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  let repaired = 0;
  for (const activity of activities) {
    if (!activity.sourceEmailId) continue;
    if (
      activity.activityType === ReservationActivityType.AIRBNB_MESSAGE &&
      activityParsesForDisplay({
        content: activity.content,
        metadataJson: activity.metadataJson,
        guestName: activity.senderName,
      })
    ) {
      continue;
    }

    const ok = await rebuildGuestMessageActivityFromAudit(activity.sourceEmailId);
    if (ok) repaired += 1;
  }

  return repaired;
}

export async function ensureLinkedGuestMessageActivities(
  scope: GuestMessageRepairScope,
): Promise<number> {
  if (!scope.organizationId) return 0;

  const audits = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: scope.organizationId,
      reservationId: { not: null },
      OR: [
        { subject: { contains: "Reserva de", mode: "insensitive" } },
        { subject: { contains: "mensaje", mode: "insensitive" } },
        { subject: { contains: "Consulta sobre", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      organizationId: true,
      reservationId: true,
      propertyId: true,
      subject: true,
      fromAddress: true,
      rawEmail: true,
      classification: true,
      createdAt: true,
    },
  });

  let created = 0;
  for (const audit of audits) {
    const [activity, pending] = await Promise.all([
      db.reservationActivity.findUnique({
        where: { sourceEmailId: audit.id },
        select: { id: true },
      }),
      db.reservationActivityPending.findUnique({
        where: { sourceEmailId: audit.id },
        select: { id: true },
      }),
    ]);
    if (activity || pending) continue;

    const emailFields = await resolveFullAuditEmailBody(audit);
    const body = buildEmailBody({
      subject: audit.subject,
      html: emailFields.html,
      text: emailFields.text,
    });
    if (!isLikelyGuestMessageEmail({ subject: audit.subject, body })) continue;

    const rebuilt = await rebuildGuestMessageActivityFromAudit(audit.id);
    if (rebuilt) created += 1;
  }

  return created;
}
