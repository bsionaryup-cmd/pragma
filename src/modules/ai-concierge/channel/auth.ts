import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import type { ConciergeOperationMode } from "@/modules/ai-concierge/channel/session-store";
import { verifyConciergeExtensionSession } from "@/modules/ai-concierge/channel/session-token";
import { toRuntimeConciergeMode } from "@/modules/ai-concierge/channel/operational-state";

type AuthorizedExtension = {
  ok: true;
  scope: TenantDataScope;
  mode: ConciergeOperationMode;
  linkId: string;
  enabled: boolean;
  paused: boolean;
  whatsappEnabled: boolean;
  airbnbEnabled: boolean;
  allowedPropertyIds: string[];
  allowedTools: string[];
};

export async function authorizeConciergeExtension(
  request: Request,
  options: { allowInactive?: boolean } = {},
): Promise<AuthorizedExtension | {
  ok: false;
  response: NextResponse;
}> {
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
  const rawToken = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const payload = rawToken
    ? verifyConciergeExtensionSession(rawToken)
    : null;
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const link = await db.conciergeExtensionLink.findUnique({
    where: { id: payload.linkId },
    include: {
      organization: { select: { id: true, status: true } },
      linkedBy: {
        select: { id: true, isActive: true },
      },
    },
  });
  // Tenant binding lives on the signed token + ConciergeExtensionLink row.
  // Do NOT require User.organizationId: platform owners often pair while
  // impersonating (effective org via cookie), and extension heartbeats have
  // no Clerk/impersonation cookies — that check caused permanent 401 after
  // a successful link/complete ("Detectada · Sin registro").
  if (
    !link ||
    link.status !== "ACTIVE" ||
    link.revokedAt ||
    link.organization.status !== "ACTIVE" ||
    !link.linkedBy.isActive ||
    link.organizationId !== payload.organizationId ||
    link.linkedByUserId !== payload.userId ||
    link.deviceIdHash !== payload.deviceHash
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const config = await db.conciergeConfiguration.findUnique({
    where: { organizationId: link.organizationId },
  });
  if (!config) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "AI Concierge no configurado" },
        { status: 423 },
      ),
    };
  }
  if (!options.allowInactive && (!config.enabled || config.paused)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: config.paused
            ? "AI Concierge pausado"
            : "AI Concierge inactivo",
        },
        { status: 423 },
      ),
    };
  }

  return {
    ok: true,
    scope: {
      organizationId: link.organizationId,
      userId: link.linkedByUserId,
    },
    mode: toRuntimeConciergeMode(config.mode),
    linkId: link.id,
    enabled: config.enabled,
    paused: config.paused,
    whatsappEnabled: config.whatsappEnabled,
    airbnbEnabled: config.airbnbEnabled,
    allowedPropertyIds: config.allowedPropertyIds,
    allowedTools: Array.isArray(config.allowedTools)
      ? config.allowedTools.filter(
          (name): name is string => typeof name === "string",
        )
      : [],
  };
}
