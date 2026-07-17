import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeConciergeExtension } from "@/modules/ai-concierge/channel/auth";
import {
  getOrCreateChannelSession,
  saveChannelSession,
} from "@/modules/ai-concierge/channel/session-store";
import type { ConciergeChannel } from "@/modules/ai-concierge/types/conversation";

export const runtime = "nodejs";

const BodySchema = z.object({
  channel: z.enum([
    "airbnb_web",
    "whatsapp_web",
    "booking",
    "messenger",
    "instagram",
    "email",
    "internal",
  ]),
  threadId: z.string().trim().min(1).max(200),
  guestMessage: z.string().trim().min(1).max(8000),
  guestLabel: z.string().trim().max(200).optional(),
  propertyId: z.string().trim().min(1).optional(),
  reservationId: z.string().trim().min(1).optional(),
  externalMessageId: z.string().trim().max(200).optional(),
  platformDetected: z.string().trim().max(80).optional(),
});

/**
 * F7: detectar + leer + comunicar. No genera respuesta al huésped.
 */
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
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const channel = body.channel as ConciergeChannel;
  if (
    (channel === "whatsapp_web" && !auth.whatsappEnabled) ||
    (channel === "airbnb_web" && !auth.airbnbEnabled)
  ) {
    return NextResponse.json(
      { error: "Canal desactivado en PRAGMA" },
      { status: 423 },
    );
  }
  if (
    body.propertyId &&
    auth.allowedPropertyIds.length > 0 &&
    !auth.allowedPropertyIds.includes(body.propertyId)
  ) {
    return NextResponse.json(
      { error: "Propiedad no autorizada para AI Concierge" },
      { status: 403 },
    );
  }
  const organizationId = auth.scope.organizationId ?? `user:${auth.scope.userId}`;

  const conversation = getOrCreateChannelSession({
    organizationId,
    channel,
    threadId: body.threadId,
    propertyId: body.propertyId,
    reservationId: body.reservationId,
    guestLabel: body.guestLabel,
  });

  saveChannelSession({
    organizationId,
    channel,
    threadId: body.threadId,
    conversation,
  });

  return NextResponse.json({
    ok: true,
    phase: 7,
    mode: "observe",
    conversationId: conversation.id,
    channel,
    threadId: body.threadId,
    platformDetected: body.platformDetected ?? channel,
    messagePreview: body.guestMessage.slice(0, 120),
    suggestedReply: null,
    outboundBlocked: true,
  });
}
