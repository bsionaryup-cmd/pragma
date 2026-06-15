/**
 * Verifica correos recibidos en Resend vs EmailIngestionAudit en BD.
 * npx tsx scripts/verify-resend-inbound-receipt.ts
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import {
  fetchResendReceivedEmail,
  listResendReceivedEmails,
} from "@/modules/airbnb-email/integrations/resend-inbound.client";
import { hashEmailContent } from "@/modules/airbnb-email/parsing/extractors";

config();
config({ path: ".env.local", override: true });

const ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const INBOUND = "samuel-silva-gqtwyc@vepcen.resend.app";
const MANUAL_FORWARD_THRESHOLD = new Date("2026-05-31T17:17:26.358Z");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function normalizeToList(to: string[] | undefined): string[] {
  return (to ?? []).map((t) => t.trim().toLowerCase());
}

function isLikelyAirbnbFrom(from: string): boolean {
  const lower = from.toLowerCase();
  return (
    lower.includes("@airbnb.com") ||
    lower.includes("@mail.airbnb.com") ||
    lower.includes("@reply.airbnb.com")
  );
}

function classifyForwardMode(input: {
  from: string;
  subject: string;
  receivedAt: string;
}): "manual_gmail_forward" | "auto_gmail_forward_or_direct" | "unknown" {
  const subject = input.subject.trim();
  const from = input.from.toLowerCase();
  const isFwd = /^(?:fwd?|fw|reenviado|re):/i.test(subject);
  const isGmailOwner = from.includes("urbanovaloft@gmail.com");
  const isAirbnbDirect = isLikelyAirbnbFrom(from);

  if (isGmailOwner && isFwd) {
    return "manual_gmail_forward";
  }
  if (isAirbnbDirect && !isFwd) {
    return "auto_gmail_forward_or_direct";
  }
  if (isGmailOwner && !isFwd) {
    // Gmail auto-forward often re-wraps without Fwd: prefix but keeps owner as envelope From
    return "auto_gmail_forward_or_direct";
  }
  return "unknown";
}

function readEnrichedGuest(enrichedFields: unknown): string | null {
  if (!enrichedFields || typeof enrichedFields !== "object" || Array.isArray(enrichedFields)) {
    return null;
  }
  const name = (enrichedFields as Record<string, unknown>).guestName;
  return typeof name === "string" ? name : null;
}

async function main() {
  const integration = await db.tenantAirbnbEmailIntegration.findUnique({
    where: { organizationId: ORG_ID },
    include: { organization: { select: { name: true } } },
  });

  const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  let resendEmails: Array<{
    id: string;
    from: string;
    to: string[];
    subject: string;
    created_at?: string;
    message_id?: string | null;
  }> = [];

  if (hasResendKey) {
    try {
      const list = await listResendReceivedEmails({ limit: 40 });
      resendEmails = (list.data ?? []).filter((row) =>
        normalizeToList(row.to).includes(INBOUND.toLowerCase()),
      );
    } catch (error) {
      console.error(
        "RESEND_LIST_ERROR:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const recentAudits = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: ORG_ID,
      createdAt: { gte: MANUAL_FORWARD_THRESHOLD },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      messageId: true,
      fromAddress: true,
      toAddress: true,
      subject: true,
      classification: true,
      processingStatus: true,
      reservationId: true,
      createdAt: true,
      processedAt: true,
      rawEmail: true,
      reservationEvent: {
        select: {
          eventKind: true,
          enrichedFields: true,
          confirmationCode: true,
        },
      },
    },
  });

  const lastAuditAny = await db.emailIngestionAudit.findFirst({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fromAddress: true,
      subject: true,
      createdAt: true,
      classification: true,
      reservationEvent: {
        select: { enrichedFields: true, eventKind: true },
      },
    },
  });

  const auditsAfterForward = recentAudits.filter(
    (a) => a.createdAt > MANUAL_FORWARD_THRESHOLD,
  );

  const resendLatest = resendEmails[0] ?? null;
  let resendLatestBody: { text?: string | null; html?: string | null } | null =
    null;

  if (resendLatest?.id && hasResendKey) {
    try {
      const full = await fetchResendReceivedEmail(resendLatest.id);
      resendLatestBody = { text: full.text, html: full.html };
    } catch {
      resendLatestBody = null;
    }
  }

  // Match latest Resend email to audit
  let matchedAudit: (typeof recentAudits)[number] | null = null;
  if (resendLatest) {
    matchedAudit =
      recentAudits.find(
        (a) =>
          a.messageId &&
          resendLatest.message_id &&
          a.messageId === resendLatest.message_id,
      ) ??
      recentAudits.find(
        (a) =>
          a.subject.trim().toLowerCase() ===
          resendLatest.subject.trim().toLowerCase(),
      ) ??
      null;
  }

  const report = {
    checkedAt: new Date().toISOString(),
    inboundAddress: INBOUND,
    integration: integration
      ? {
          organizationName: integration.organization.name,
          lastEmailReceivedAt: integration.lastEmailReceivedAt?.toISOString(),
          lastProcessedAt: integration.lastProcessedAt?.toISOString(),
          syncStatus: integration.syncStatus,
        }
      : null,
    referenceBeforeAutoForward: MANUAL_FORWARD_THRESHOLD.toISOString(),
    resendApiAvailable: hasResendKey,
    resendEmailsToInbound: resendEmails.length,
    resendLatest: resendLatest
      ? {
          id: resendLatest.id,
          receivedAt: resendLatest.created_at ?? null,
          from: resendLatest.from,
          subject: resendLatest.subject,
          to: resendLatest.to,
          messageId: resendLatest.message_id ?? null,
          forwardMode: classifyForwardMode({
            from: resendLatest.from,
            subject: resendLatest.subject,
            receivedAt: resendLatest.created_at ?? new Date().toISOString(),
          }),
          afterAutoForwardSetup:
            resendLatest.created_at != null &&
            new Date(resendLatest.created_at) > MANUAL_FORWARD_THRESHOLD,
        }
      : null,
    resendRecentToInbound: resendEmails.slice(0, 10).map((e) => ({
      receivedAt: e.created_at,
      from: e.from,
      subject: e.subject.slice(0, 100),
      forwardMode: classifyForwardMode({
        from: e.from,
        subject: e.subject,
        receivedAt: e.created_at ?? new Date().toISOString(),
      }),
      afterAutoForwardSetup:
        e.created_at != null && new Date(e.created_at) > MANUAL_FORWARD_THRESHOLD,
    })),
    dbLastAudit: lastAuditAny
      ? {
          auditId: lastAuditAny.id,
          createdAt: lastAuditAny.createdAt.toISOString(),
          fromAddress: lastAuditAny.fromAddress,
          subject: lastAuditAny.subject,
          classification: lastAuditAny.classification,
          forwardMode: classifyForwardMode({
            from: lastAuditAny.fromAddress,
            subject: lastAuditAny.subject,
            receivedAt: lastAuditAny.createdAt.toISOString(),
          }),
          enrichedGuest: readEnrichedGuest(
            lastAuditAny.reservationEvent?.enrichedFields,
          ),
          eventKind: lastAuditAny.reservationEvent?.eventKind ?? null,
          afterAutoForwardSetup:
            lastAuditAny.createdAt > MANUAL_FORWARD_THRESHOLD,
        }
      : null,
    auditsAfterAutoForwardCount: auditsAfterForward.length,
    auditsAfterAutoForward: auditsAfterForward.map((a) => ({
      auditId: a.id,
      createdAt: a.createdAt.toISOString(),
      fromAddress: a.fromAddress,
      subject: a.subject.slice(0, 120),
      classification: a.classification,
      processingStatus: a.processingStatus,
      reservationId: a.reservationId,
      forwardMode: classifyForwardMode({
        from: a.fromAddress,
        subject: a.subject,
        receivedAt: a.createdAt.toISOString(),
      }),
      createdAudit: true,
      enrichment: a.reservationEvent
        ? {
            eventKind: a.reservationEvent.eventKind,
            confirmationCode: a.reservationEvent.confirmationCode,
            guestName: readEnrichedGuest(a.reservationEvent.enrichedFields),
            enriched: Boolean(readEnrichedGuest(a.reservationEvent.enrichedFields)),
          }
        : { enriched: false, reason: "no_reservation_email_event" },
      resendProvider:
        a.rawEmail &&
        typeof a.rawEmail === "object" &&
        !Array.isArray(a.rawEmail)
          ? (a.rawEmail as Record<string, unknown>).provider ?? null
          : null,
    })),
    resendLatestMatchedAudit: matchedAudit
      ? {
          auditId: matchedAudit.id,
          createdAt: matchedAudit.createdAt.toISOString(),
          enriched: Boolean(
            readEnrichedGuest(matchedAudit.reservationEvent?.enrichedFields),
          ),
        }
      : null,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
