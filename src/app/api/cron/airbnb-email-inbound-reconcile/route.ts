import { NextResponse } from "next/server";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { reconcileMissedResendInboundEmails } from "@/modules/airbnb-email/ingestion/reconcile-resend-inbound";
import { isResendInboundConfigured } from "@/modules/airbnb-email/integrations/resend-inbound.client";
import { runUnlinkedEmailEnrichmentRetryJob } from "@/modules/airbnb-email/matching/unlinked-email-enrichment-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Poll Resend receiving + reintenta enriquecimiento (webhook fallback).
 * GET /api/cron/airbnb-email-inbound-reconcile
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  airbnbEmailLog.info("cron_airbnb_inbound_reconcile_start");

  let resend: Awaited<ReturnType<typeof reconcileMissedResendInboundEmails>> | null =
    null;
  if (isResendInboundConfigured() && process.env.RESEND_API_KEY?.trim()) {
    try {
      resend = await reconcileMissedResendInboundEmails({ limit: 40, maxPages: 3 });
    } catch (error) {
      airbnbEmailLog.warn("cron_resend_poll_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const retry = await runUnlinkedEmailEnrichmentRetryJob({
    limit: 60,
    lookbackHours: 24 * 30,
  });

  airbnbEmailLog.info("cron_airbnb_inbound_reconcile_done", {
    durationMs: Date.now() - startedAt,
    resendListed: resend?.listed ?? 0,
    resendIngested: resend?.ingested ?? 0,
    retryScanned: retry.scanned,
    retryLinked: retry.linked,
  });

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    resend,
    retry,
  });
}
