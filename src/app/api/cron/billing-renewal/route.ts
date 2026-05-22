import { NextResponse } from "next/server";
import {
  ensureBillingAccount,
  getBillingAccountSafe,
} from "@/services/billing/billing.service";
import { reconcileBillingLifecycle } from "@/modules/billing/services/billing-lifecycle.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Renueva ciclo de suscripción: facturas abiertas, PAST_DUE y LOCKED por gracia.
 * Programar en Vercel Cron con Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = (await getBillingAccountSafe()) ?? (await ensureBillingAccount());
  if (!account) {
    return NextResponse.json(
      { ok: false, message: "Facturación no disponible (migración pendiente)" },
      { status: 503 },
    );
  }

  const reconciled = await reconcileBillingLifecycle(account);

  return NextResponse.json({
    ok: true,
    status: reconciled.status,
    gracePeriodEndsAt: reconciled.gracePeriodEndsAt?.toISOString() ?? null,
    currentPeriodEnd: reconciled.currentPeriodEnd?.toISOString() ?? null,
  });
}
