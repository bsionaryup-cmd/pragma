import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { extendTenantTrialByOwner } from "@/services/platform/owner-billing-actions.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { days?: number; reason?: string };
    if (!Number.isFinite(body.days)) {
      return NextResponse.json({ error: "days inválido" }, { status: 400 });
    }
    await extendTenantTrialByOwner({
      platformUser,
      organizationId: id,
      days: body.days!,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

