import { NextResponse } from "next/server";
import { processWompiWebhook } from "@/modules/billing/services/webhook.service";

export const runtime = "nodejs";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-event-checksum");
  const rawBody = await request.text();

  const result = await processWompiWebhook({
    rawBody,
    signature,
    clientIp: clientIp(request),
  });

  return NextResponse.json(
    { ok: result.ok, message: result.message },
    { status: result.status },
  );
}
