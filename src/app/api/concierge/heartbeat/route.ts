import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeConciergeExtension } from "@/modules/ai-concierge/channel/auth";
import { recordConciergeHeartbeat } from "@/modules/ai-concierge/channel/operational-state";

export const runtime = "nodejs";

const BodySchema = z.object({
  version: z.string().trim().max(40).optional(),
  channels: z.record(z.string(), z.unknown()).optional(),
  error: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await authorizeConciergeExtension(request, {
    allowInactive: true,
  });
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await recordConciergeHeartbeat({
    linkId: auth.linkId,
    version: parsed.data.version,
    channels: parsed.data.channels,
    error: parsed.data.error,
  });
  return NextResponse.json({
    ok: true,
    enabled: auth.enabled,
    paused: auth.paused,
    mode: auth.mode,
    channels: {
      whatsapp_web: auth.whatsappEnabled,
      airbnb_web: auth.airbnbEnabled,
    },
    serverTime: new Date().toISOString(),
  });
}
