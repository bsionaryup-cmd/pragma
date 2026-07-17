import { NextResponse } from "next/server";
import { authorizeConciergeExtension } from "@/modules/ai-concierge/channel/auth";
import { getConciergeDashboard } from "@/modules/ai-concierge/channel/operational-state";

export const runtime = "nodejs";

/**
 * Health / estado del canal Concierge (extensión y operadores).
 * Auth: Bearer CONCIERGE_EXTENSION_SECRET
 */
export async function GET(request: Request) {
  const auth = await authorizeConciergeExtension(request, {
    allowInactive: true,
  });
  if (!auth.ok) return auth.response;

  const organizationId =
    auth.scope.organizationId ?? `user:${auth.scope.userId}`;
  const dashboard = await getConciergeDashboard(organizationId);

  return NextResponse.json({
    ok: true,
    service: "pragma-ai-concierge",
    transport: "https-rest",
    websocket: false,
    note: "Canal vía HTTPS REST (menor impacto que WebSocket en App Router). Reconexión en la extensión.",
    modeSource: "pragma-organization-configuration",
    scope: {
      organizationId: auth.scope.organizationId,
      userId: auth.scope.userId,
    },
    enabled: auth.enabled,
    paused: auth.paused,
    mode: auth.mode,
    dashboard,
    serverTime: new Date().toISOString(),
  });
}
