import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  handleUserCreatedWebhook,
  handleUserDeletedWebhook,
  handleUserUpdatedWebhook,
} from "@/services/users/user.service";
import type { ClerkWebhookEvent } from "@/types/clerk-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET no configurado");
    return NextResponse.json(
      { error: "Webhook no configurado" },
      { status: 500 },
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[clerk-webhook] Headers Svix faltantes");
    return NextResponse.json({ error: "Headers inválidos" }, { status: 400 });
  }

  const payload = await req.text();

  let event: ClerkWebhookEvent;

  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("[clerk-webhook] Firma inválida", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
        await handleUserCreatedWebhook(event.data);
        break;
      case "user.updated":
        await handleUserUpdatedWebhook(event.data);
        break;
      case "user.deleted":
        await handleUserDeletedWebhook(event.data.id);
        break;
      default:
        console.info("[clerk-webhook] Evento ignorado:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[clerk-webhook] Error procesando", event.type, err);
    return NextResponse.json(
      { error: "Error al procesar evento" },
      { status: 500 },
    );
  }
}
