import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runGuestPaymentReconciliationJob } from "@/services/payments/guest-payment-reconcile.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Expira Payment Links vencidos y reconcilia pagos guest vía API Wompi (fallback al webhook).
 * Programar cada 10–15 min: GET /api/cron/guest-payment-reconcile
 * Authorization: Bearer CRON_SECRET (o ?secret= en entornos que no envían header)
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await runGuestPaymentReconciliationJob();
  return NextResponse.json({ ok: true, ...result });
}
