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
