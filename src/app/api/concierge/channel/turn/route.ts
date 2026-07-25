import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeConciergeExtension } from "@/modules/ai-concierge/channel/auth";
import {
  getOrCreateChannelSession,
  saveChannelSession,
} from "@/modules/ai-concierge/channel/session-store";
import { composeConciergeReply } from "@/modules/ai-concierge/engine/compose-reply";
import {
  claimConciergeExternalMessage,
  recordConciergeTurnState,
} from "@/modules/ai-concierge/channel/operational-state";
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
});

/**
 * F8–F12: turn completo. Modo resuelto desde configuración del tenant.
 * Nunca envía al canal — la extensión decide insert/send según mayAutoSend.
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

  // Dual idempotency: provider message id (when stable) + thread+text (when DOM ids drift).
  const textClaimId = `tmsg:${createHash("sha256")
    .update(`${channel}\n${body.threadId}\n${body.guestMessage}`)
    .digest("hex")
    .slice(0, 40)}`;
  const claimIds = [
    body.externalMessageId?.trim() || null,
    textClaimId,
  ].filter((value): value is string => Boolean(value));

  for (const externalMessageId of claimIds) {
    const claim = await claimConciergeExternalMessage({
      organizationId,
      extensionLinkId: auth.linkId,
      channel,
      externalMessageId,
    });
    if (claim.duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        suggestedReply: null,
        mayAutoSend: false,
        outboundBlocked: true,
      });
    }
  }

  let conversation = getOrCreateChannelSession({
    organizationId,
    channel,
    threadId: body.threadId,
    propertyId: body.propertyId,
    reservationId: body.reservationId,
    guestLabel: body.guestLabel,
  });

  const startedAt = Date.now();
  const composed = await composeConciergeReply({
    conversation,
    guestMessage: body.guestMessage,
    scope: auth.scope,
    mode: auth.mode,
    threadId: body.threadId,
    allowedPropertyIds: auth.allowedPropertyIds,
    allowedTools: auth.allowedTools,
    externalMessageId: body.externalMessageId,
  });

  conversation = composed.conversation;
  saveChannelSession({
    organizationId,
    channel,
    threadId: body.threadId,
    conversation,
    run: composed.run,
  });

  await recordConciergeTurnState({
    organizationId,
    extensionLinkId: auth.linkId,
    channel,
    threadId: body.threadId,
    runId: composed.run.id,
    intent: composed.run.intent.intent,
    path: composed.run.decision.path,
    durationMs: Date.now() - startedAt,
    toolNames: composed.run.toolInvocations.map((tool) => tool.toolName),
    ok: composed.run.auditor.verified || composed.run.decision.path !== "deterministic",
  });

  return NextResponse.json({
    ok: true,
    mode: composed.mode,
    conversationId: conversation.id,
    intent: composed.run.intent,
    path: composed.run.decision.path,
    suggestedReply: composed.suggestedReply,
    autoEligible: composed.autoEligible,
    mayAutoSend: composed.mayAutoSend,
    usedLlm: composed.usedLlm,
    learningRecorded: composed.learningRecorded,
    auditor: composed.run.auditor,
    toolInvocations: composed.run.toolInvocations.map((t) => ({
      toolName: t.toolName,
      status: t.status,
      ok: t.result?.ok ?? false,
    })),
    outboundBlocked: !composed.mayAutoSend,
  });
}
