import { NextResponse } from "next/server";
import { getBillingEpaycoCheckoutSession } from "@/services/billing/billing-epayco-checkout-session.service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await context.params;
  const result = await getBillingEpaycoCheckoutSession(invoiceId);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json(result.session);
}
