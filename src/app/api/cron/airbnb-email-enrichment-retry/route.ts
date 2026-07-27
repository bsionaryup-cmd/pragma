import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { runUnlinkedEmailEnrichmentRetryJob } from "@/modules/airbnb-email/matching/unlinked-email-enrichment-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reintenta vincular/enriquecer correos Airbnb ya recibidos pero sin reserva.
 * Programar cada 5 min: GET /api/cron/airbnb-email-enrichment-retry
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  airbnbEmailLog.info("cron_email_enrichment_retry_start");

  const result = await runUnlinkedEmailEnrichmentRetryJob({
    limit: 40,
    lookbackHours: 24 * 14,
  });

  airbnbEmailLog.info("cron_email_enrichment_retry_done", {
    durationMs: Date.now() - startedAt,
    ...result,
  });

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
  });
}
