import { NextResponse } from "next/server";
import { getGuestEpaycoCheckoutSession } from "@/services/payments/guest-epayco-checkout-session.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ linkId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { linkId } = await context.params;
  const result = await getGuestEpaycoCheckoutSession(linkId);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.json(result.session);
}
