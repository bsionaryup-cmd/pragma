/**
 * Ingesta correos recibidos en Resend que no llegaron vía webhook.
 */
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { db } from "@/lib/db";
import {
  fetchResendReceivedEmail,
  listResendReceivedEmails,
} from "@/modules/airbnb-email/integrations/resend-inbound.client";
import { processInboundAirbnbEmail } from "@/modules/airbnb-email/ingestion/process-inbound-email";
import { resolvePropertyIdFromEmailSignals } from "@/modules/airbnb-email/matching/property-resolver";
import {
  buildEmailBody,
  extractReservationSignals,
  hashEmailContent,
} from "@/modules/airbnb-email/parsing/extractors";
import { ensureReservationActivityFromAuditRow } from "@/modules/reservation-activity/services/ensure-reservation-activity-from-email";
import {
  recordIntegrationInboundReceived,
  resolveOrganizationByInboundEmail,
  touchIntegrationEmailReceived,
} from "@/services/integrations/tenant-airbnb-email-integration.service";

export type ResendInboundReconcileResult = {
  listed: number;
  ingested: number;
  skippedDuplicate: number;
  skippedUnknownTenant: number;
  failed: number;
};

async function auditExistsForResendEmail(input: {
  messageId: string | null | undefined;
  from: string;
  subject: string;
  body: string;
  organizationId: string;
}): Promise<boolean> {
  const contentHash = hashEmailContent({
    messageId: input.messageId ?? undefined,
    from: input.from,
    subject: input.subject,
    body: input.body,
    organizationId: input.organizationId,
  });

  const existing = await db.emailIngestionAudit.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        ...(input.messageId?.trim()
          ? [{ messageId: input.messageId.trim() }]
          : []),
        { contentHash },
      ],
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function reconcileMissedResendInboundEmails(input?: {
  limit?: number;
  maxPages?: number;
}): Promise<ResendInboundReconcileResult> {
  const limit = input?.limit ?? 40;
  const maxPages = input?.maxPages ?? 3;
  const result: ResendInboundReconcileResult = {
    listed: 0,
    ingested: 0,
    skippedDuplicate: 0,
    skippedUnknownTenant: 0,
    failed: 0,
  };

  let after: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const list = await listResendReceivedEmails({ limit, after });
    const rows = list.data ?? [];
    result.listed += rows.length;

    for (const row of rows) {
      try {
        const resolved = await resolveOrganizationByInboundEmail(row.to ?? []);
        if (!resolved?.enabled) {
          result.skippedUnknownTenant += 1;
          continue;
        }

        const full = await fetchResendReceivedEmail(row.id);
        const bodyPreview = buildEmailBody({
          subject: full.subject,
          html: full.html,
          text: full.text,
        });

        const already = await auditExistsForResendEmail({
          messageId: full.message_id ?? row.message_id,
          from: full.from,
          subject: full.subject,
          body: bodyPreview,
          organizationId: resolved.organizationId,
        });

        if (already) {
          const existingAudit = await db.emailIngestionAudit.findFirst({
            where: {
              organizationId: resolved.organizationId,
              OR: [
                ...(full.message_id ?? row.message_id
                  ? [{ messageId: (full.message_id ?? row.message_id)!.trim() }]
                  : []),
                {
                  contentHash: hashEmailContent({
                    messageId: full.message_id ?? row.message_id ?? undefined,
                    from: full.from,
                    subject: full.subject,
                    body: bodyPreview,
                    organizationId: resolved.organizationId,
                  }),
                },
              ],
            },
            select: {
              id: true,
              reservationId: true,
              propertyId: true,
              subject: true,
              fromAddress: true,
              rawEmail: true,
              classification: true,
              createdAt: true,
            },
          });

          if (existingAudit) {
            const raw = existingAudit.rawEmail as Record<string, unknown> | null;
            await ensureReservationActivityFromAuditRow({
              organizationId: resolved.organizationId,
              auditId: existingAudit.id,
              reservationId: existingAudit.reservationId,
              propertyId: existingAudit.propertyId,
              subject: existingAudit.subject,
              from: existingAudit.fromAddress,
              html: typeof raw?.html === "string" ? raw.html : null,
              text: typeof raw?.text === "string" ? raw.text : null,
              receivedAt: existingAudit.createdAt.toISOString(),
              pipelineEventKind: existingAudit.classification,
            });
          }

          result.skippedDuplicate += 1;
          continue;
        }

        await recordIntegrationInboundReceived(resolved.integrationId);

        const signals = extractReservationSignals({
          subject: full.subject,
          body: bodyPreview,
          html: full.html,
        });

        const propertyResolution = await resolvePropertyIdFromEmailSignals(
          resolved.organizationId,
          signals,
          null,
        );

        const outcome = await processInboundAirbnbEmail(
          {
            messageId: full.message_id ?? row.message_id ?? row.id,
            from: full.from,
            to: full.to[0] ?? null,
            subject: full.subject,
            html: full.html,
            text: full.text,
            receivedAt: full.created_at ?? row.created_at,
            raw: { provider: "resend", source: "inbound_reconcile", emailId: row.id },
          },
          {
            organizationId: resolved.organizationId,
            integrationId: resolved.integrationId,
            propertyId: propertyResolution.propertyId,
            listingAmbiguous: propertyResolution.ambiguous,
          },
        );

        await touchIntegrationEmailReceived(
          resolved.integrationId,
          outcome.status !== "failed",
          outcome.status === "failed" ? outcome.errorReason : null,
        );

        if (outcome.status === "skipped_duplicate") {
          result.skippedDuplicate += 1;
        } else if (outcome.status === "failed") {
          result.failed += 1;
        } else {
          result.ingested += 1;
        }

        if (outcome.auditId) {
          await ensureReservationActivityFromAuditRow({
            organizationId: resolved.organizationId,
            auditId: outcome.auditId,
            reservationId: outcome.reservationId ?? null,
            propertyId: propertyResolution.propertyId,
            subject: full.subject,
            from: full.from,
            html: full.html,
            text: full.text,
            receivedAt: full.created_at ?? row.created_at ?? null,
            pipelineEventKind: outcome.eventKind ?? null,
          });
        }
      } catch (error) {
        result.failed += 1;
        airbnbEmailLog.warn("resend_inbound_reconcile_row_failed", {
          emailId: row.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    if (!list.has_more || rows.length === 0) break;
    after = rows[rows.length - 1]?.id;
  }

  airbnbEmailLog.info("resend_inbound_reconcile_done", result);
  return result;
}
