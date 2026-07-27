import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import {
  accountNeedsLifecycleReconciliation,
  reconcileBillingLifecycle,
} from "@/modules/billing/services/billing-lifecycle.service";
import { expireStaleSalesQuotes } from "@/modules/sales/services/sales-quote.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Renueva ciclo de suscripción: facturas abiertas, PAST_DUE y LOCKED por gracia.
 * Programar en Vercel Cron con Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
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

  const expiredQuotes = await expireStaleSalesQuotes();

  return NextResponse.json({
    ok: true,
    processed: reconciled.length,
    expiredSalesQuotes: expiredQuotes,
    accounts: reconciled,
  });
}
