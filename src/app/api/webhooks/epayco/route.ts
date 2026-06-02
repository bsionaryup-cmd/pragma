import { NextResponse } from "next/server";
import { processEpaycoConfirmationWebhook } from "@/modules/integrations/epayco/epayco-webhook.service";

export const runtime = "nodejs";

function parseConfirmationPayload(
  contentType: string | null,
  rawBody: string,
  formData?: FormData,
): Record<string, string> {
  if (formData) {
    const record: Record<string, string> = {};
    formData.forEach((value, key) => {
      record[key] = String(value);
    });
    return record;
  }

  if (contentType?.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const record: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value == null) continue;
        record[key] = String(value);
      }
      return record;
    } catch {
      return {};
    }
  }

  const record: Record<string, string> = {};
  const params = new URLSearchParams(rawBody);
  params.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type");

  let payload: Record<string, string> = {};

  if (contentType?.includes("multipart/form-data") || contentType?.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    payload = parseConfirmationPayload(contentType, "", formData);
  } else {
    const rawBody = await request.text();
    payload = parseConfirmationPayload(contentType, rawBody);
  }

  const result = await processEpaycoConfirmationWebhook(payload);

  return NextResponse.json(
    { ok: result.ok, message: result.message },
    { status: result.status },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    payload[key] = value;
  });

  const result = await processEpaycoConfirmationWebhook(payload);

  return NextResponse.json(
    { ok: result.ok, message: result.message },
    { status: result.status },
  );
}
