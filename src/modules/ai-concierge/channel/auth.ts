import { NextResponse } from "next/server";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import type { ConciergeOperationMode } from "@/modules/ai-concierge/channel/session-store";

export function authorizeConciergeExtension(request: Request): {
  ok: true;
  scope: TenantDataScope;
  mode: ConciergeOperationMode;
} | {
  ok: false;
  response: NextResponse;
} {
  const secret = process.env.CONCIERGE_EXTENSION_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "CONCIERGE_EXTENSION_SECRET no configurado" },
        { status: 503 },
      ),
    };
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const orgId = request.headers.get("x-concierge-org-id")?.trim() || null;
  const userId = request.headers.get("x-concierge-user-id")?.trim();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "x-concierge-user-id requerido" },
        { status: 400 },
      ),
    };
  }
  const modeRaw = (request.headers.get("x-concierge-mode") ?? "observe").trim();
  const mode: ConciergeOperationMode =
    modeRaw === "manual" ||
    modeRaw === "assisted" ||
    modeRaw === "autonomous" ||
    modeRaw === "observe"
      ? modeRaw
      : "observe";

  return {
    ok: true,
    scope: { organizationId: orgId, userId },
    mode,
  };
}
