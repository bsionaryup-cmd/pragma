import { NextResponse } from "next/server";
import {
  reconcileWompiTransactionEvent,
  verifyWompiEventChecksum,
} from "@/services/billing/wompi.service";

export async function POST(request: Request) {
  const secret = process.env.WOMPI_EVENTS_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "WOMPI_EVENTS_SECRET no configurado" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-event-checksum");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ ok: false, message: "Firma ausente" }, { status: 401 });
  }

  if (
    !verifyWompiEventChecksum({
      payload: rawBody,
      signature,
      secret,
    })
  ) {
    return NextResponse.json({ ok: false, message: "Firma inválida" }, { status: 401 });
  }

  let event: Parameters<typeof reconcileWompiTransactionEvent>[0];
  try {
    event = JSON.parse(rawBody) as Parameters<typeof reconcileWompiTransactionEvent>[0];
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido" }, { status: 400 });
  }

  const result = await reconcileWompiTransactionEvent(event);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
