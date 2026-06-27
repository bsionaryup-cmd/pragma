import { NextResponse } from "next/server";
import { processTTLockWebhook } from "@/modules/integrations/ttlock/ttlock.webhook";

export const dynamic = "force-dynamic";

type TTLockWebhookRouteProps = {
  params: Promise<{ organizationId: string }>;
};

export async function POST(
  request: Request,
  { params }: TTLockWebhookRouteProps,
) {
  const webhookSecret = process.env.TTLOCK_WEBHOOK_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "TTLock webhook no configurado" },
        { status: 503 },
      );
    }
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (webhookSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { organizationId } = await params;
  const rawBody = await request.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const result = await processTTLockWebhook({
    organizationId,
    payload,
    rawBody,
  });

  return NextResponse.json(
    { ok: result.ok, message: result.message },
    { status: result.status },
  );
}
