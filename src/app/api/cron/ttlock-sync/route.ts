import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runTTLockScheduledSync } from "@/modules/integrations/ttlock/ttlock.scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Polling TTLock cada 5–10 min (configurar en Vercel Cron).
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await runTTLockScheduledSync();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
  });
}
