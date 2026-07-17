import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeConciergeExtension } from "@/modules/ai-concierge/channel/auth";
import { runCommercialBookingFlow } from "@/modules/ai-concierge/commercial/booking-flow";

export const runtime = "nodejs";

const BodySchema = z.object({
  propertyId: z.string().trim().min(1),
  checkIn: z.string().trim().min(8),
  checkOut: z.string().trim().min(8),
  guestFirstName: z.string().trim().min(1),
  guestLastName: z.string().trim().optional(),
  guestEmail: z.string().trim().email().optional(),
  guestPhone: z.string().trim().optional(),
  adults: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: Request) {
  const auth = await authorizeConciergeExtension(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (
    auth.allowedPropertyIds.length > 0 &&
    !auth.allowedPropertyIds.includes(parsed.data.propertyId)
  ) {
    return NextResponse.json(
      { error: "Propiedad no autorizada para AI Concierge" },
      { status: 403 },
    );
  }

  const result = await runCommercialBookingFlow({
    scope: auth.scope,
    allowedPropertyIds: auth.allowedPropertyIds,
    allowedTools: auth.allowedTools,
    ...parsed.data,
  });

  return NextResponse.json({ phase: 11, ...result }, { status: result.ok ? 200 : 409 });
}
