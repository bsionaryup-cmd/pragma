import { NextResponse } from "next/server";
import { runGuestPaymentReconciliationJob } from "@/services/payments/guest-payment-reconcile.service";

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
 * Expira Payment Links vencidos y reconcilia pagos guest vía API Wompi (fallback al webhook).
 * Programar cada 10–15 min: GET /api/cron/guest-payment-reconcile
 * Authorization: Bearer CRON_SECRET (o ?secret= en entornos que no envían header)
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await runGuestPaymentReconciliationJob();
  return NextResponse.json({ ok: true, ...result });
}
