import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  createConciergePairingChallenge,
  renewConciergeExtensionSession,
} from "@/modules/ai-concierge/channel/operational-state";

export const runtime = "nodejs";

const BodySchema = z.object({
  deviceId: z.string().trim().min(16).max(200),
  version: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const [auth, scope] = await Promise.all([
    requirePermission("concierge:manage"),
    requireTenantDataScope(),
  ]);
  if (!scope.organizationId) {
    return NextResponse.json(
      { error: "Organización requerida" },
      { status: 409 },
    );
  }

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

  const renewed = await renewConciergeExtensionSession({
    organizationId: scope.organizationId,
    userId: auth.dbUserId,
    deviceId: parsed.data.deviceId,
    version: parsed.data.version,
  });
  if (renewed) {
    return NextResponse.json({ ok: true, kind: "session", ...renewed });
  }

  const challenge = await createConciergePairingChallenge({
    organizationId: scope.organizationId,
    userId: auth.dbUserId,
    deviceId: parsed.data.deviceId,
    version: parsed.data.version,
  });
  return NextResponse.json({
    ok: true,
    kind: "pairing",
    ...challenge,
  });
}
