import { NextResponse } from "next/server";
import { runTTLockScheduledSync } from "@/modules/integrations/ttlock/ttlock.scheduler";

export const dynamic = "force-dynamic";
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
 * Polling TTLock cada 5–10 min (configurar en Vercel Cron).
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
