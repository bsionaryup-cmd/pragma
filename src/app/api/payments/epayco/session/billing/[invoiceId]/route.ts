import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth";
import { requireBillingAccountId } from "@/lib/billing/resolve-billing-account";
import type { AppUserRole } from "@/types/auth";
import { getBillingEpaycoCheckoutSession } from "@/services/billing/billing-epayco-checkout-session.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const auth = await getAuthContext();
  if (!auth || !hasPermission(auth.role as AppUserRole, "billing:manage")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoiceId } = await context.params;
  const billingAccountId = await requireBillingAccountId();
  const result = await getBillingEpaycoCheckoutSession(invoiceId, billingAccountId);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json(result.session);
}
