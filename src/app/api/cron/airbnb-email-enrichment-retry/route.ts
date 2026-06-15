import { NextResponse } from "next/server";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { runUnlinkedEmailEnrichmentRetryJob } from "@/modules/airbnb-email/matching/unlinked-email-enrichment-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Reintenta vincular/enriquecer correos Airbnb ya recibidos pero sin reserva.
 * Programar cada 5 min: GET /api/cron/airbnb-email-enrichment-retry
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
