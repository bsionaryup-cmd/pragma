import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  accountNeedsLifecycleReconciliation,
  reconcileBillingLifecycle,
} from "@/modules/billing/services/billing-lifecycle.service";

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

  const accounts = await db.billingAccount.findMany();
  const reconciled = [];

  for (const account of accounts) {
    const current = accountNeedsLifecycleReconciliation(account)
      ? await reconcileBillingLifecycle(account)
      : account;
    reconciled.push({
      id: current.id,
      organizationId: current.organizationId,
      status: current.status,
      gracePeriodEndsAt: current.gracePeriodEndsAt?.toISOString() ?? null,
      currentPeriodEnd: current.currentPeriodEnd?.toISOString() ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    processed: reconciled.length,
    accounts: reconciled,
  });
}
