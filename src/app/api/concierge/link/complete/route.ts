import { NextResponse } from "next/server";
import { z } from "zod";
import { completeConciergePairing } from "@/modules/ai-concierge/channel/operational-state";

export const runtime = "nodejs";

const BodySchema = z.object({
  pairingToken: z.string().trim().min(32).max(200),
  deviceId: z.string().trim().min(16).max(200),
  version: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
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
  try {
    const linked = await completeConciergePairing(parsed.data);
    return NextResponse.json({ ok: true, ...linked });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PAIRING_INVALID_OR_EXPIRED"
    ) {
      return NextResponse.json(
        { error: "Vinculación inválida o expirada" },
        { status: 401 },
      );
    }
    throw error;
  }
}
