import { NextResponse } from "next/server";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { reconcileMissedResendInboundEmails } from "@/modules/airbnb-email/ingestion/reconcile-resend-inbound";
import { isResendInboundConfigured } from "@/modules/airbnb-email/integrations/resend-inbound.client";
import { logAirbnbEnrichmentHealthSnapshot } from "@/modules/airbnb-email/observability/enrichment-health-snapshot";
import { runUnlinkedEmailEnrichmentRetryJob } from "@/modules/airbnb-email/matching/unlinked-email-enrichment-retry";
import { runAirbnbEmailLinkageRepairJob } from "@/modules/airbnb-email/repair/run-linkage-repair-job";
import { runMisclassifiedConfirmationRepairJob } from "@/modules/airbnb-email/repair/run-misclassified-confirmation-repair-job";
import { runZeroAmountFinancialBackfillJob } from "@/modules/airbnb-email/repair/run-zero-amount-financial-backfill-job";
import { syncGuestMessageActivitiesForFeed } from "@/modules/reservation-activity/services/sync-guest-message-activities";
import { db } from "@/lib/db";

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

  const linkageRepair = await runAirbnbEmailLinkageRepairJob();

  const misclassifiedRepair = await runMisclassifiedConfirmationRepairJob({
    limit: 40,
  });

  const zeroAmountBackfill = await runZeroAmountFinancialBackfillJob({
    limit: 40,
  });

  const orgIds = await db.tenantAirbnbEmailIntegration.findMany({
    where: { enabled: true },
    select: { organizationId: true },
  });
  for (const row of orgIds) {
    await syncGuestMessageActivitiesForFeed({
      organizationId: row.organizationId,
      userId: "cron",
    });
  }

  const health = await logAirbnbEnrichmentHealthSnapshot();

  airbnbEmailLog.info("cron_airbnb_inbound_reconcile_done", {
    durationMs: Date.now() - startedAt,
    resendListed: resend?.listed ?? 0,
    resendIngested: resend?.ingested ?? 0,
    retryScanned: retry.scanned,
    retryLinked: retry.linked,
    linkageRepairScanned: linkageRepair.scanned,
    linkageRepairRelocated: linkageRepair.relocated,
    linkageRepairFinancialBackfilled: linkageRepair.financialBackfilled,
    misclassifiedRepairScanned: misclassifiedRepair.scanned,
    misclassifiedRepairRepaired: misclassifiedRepair.repaired,
    misclassifiedRepairFinancialBackfilled: misclassifiedRepair.financialBackfilled,
    zeroAmountBackfillScanned: zeroAmountBackfill.scanned,
    zeroAmountBackfillApplied: zeroAmountBackfill.applied,
    healthUnlinkedStale24h: health.unlinkedAuditsOlderThan24h,
    healthPlaceholderZeroAmount: health.placeholderZeroAmountActive,
    healthActiveWithoutEmailEvent: health.activeAirbnbWithoutEmailEvent,
    healthMisclassifiedCanceled: health.misclassifiedCanceledConfirmSubject,
  });

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    resend,
    retry,
    linkageRepair,
    misclassifiedRepair,
    zeroAmountBackfill,
    health,
  });
}
