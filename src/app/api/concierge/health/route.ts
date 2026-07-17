import { NextResponse } from "next/server";
import { authorizeConciergeExtension } from "@/modules/ai-concierge/channel/auth";
import { listChannelSessionSummaries } from "@/modules/ai-concierge/channel/session-store";
import { listRecentToolAudits } from "@/modules/ai-concierge/tools/read/context";
import { listLearningProposals } from "@/modules/ai-concierge/learning/proposals";
import { getConciergeRuntimeMetrics } from "@/modules/ai-concierge/engine/metrics";

export const runtime = "nodejs";

/**
 * Health / estado del canal Concierge (extensión y operadores).
 * Auth: Bearer CONCIERGE_EXTENSION_SECRET
 */
export async function GET(request: Request) {
  const auth = authorizeConciergeExtension(request);
  if (!auth.ok) return auth.response;

  const organizationId =
    auth.scope.organizationId ?? `user:${auth.scope.userId}`;

  return NextResponse.json({
    ok: true,
    service: "pragma-ai-concierge",
    transport: "https-rest",
    websocket: false,
    note: "Canal vía HTTPS REST (menor impacto que WebSocket en App Router). Reconexión en la extensión.",
    modeHeader: "x-concierge-mode",
    scope: {
      organizationId: auth.scope.organizationId,
      userId: auth.scope.userId,
    },
    sessions: listChannelSessionSummaries(organizationId).slice(-20),
    recentToolAudits: listRecentToolAudits(10),
    learningProposals: listLearningProposals(10),
    metrics: getConciergeRuntimeMetrics(),
    serverTime: new Date().toISOString(),
  });
}
