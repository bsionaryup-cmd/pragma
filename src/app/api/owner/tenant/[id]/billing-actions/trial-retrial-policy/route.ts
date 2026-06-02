import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { setTenantTrialRetrialPolicyByOwner } from "@/services/platform/owner-billing-actions.service";
import type { TrialRetrialPolicy } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { policy?: TrialRetrialPolicy; reason?: string };

    if (body.policy !== "DEFAULT" && body.policy !== "ALLOW" && body.policy !== "BLOCK") {
      return NextResponse.json({ error: "policy inválida" }, { status: 400 });
    }

    await setTenantTrialRetrialPolicyByOwner({
      platformUser,
      organizationId: id,
      policy: body.policy,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
