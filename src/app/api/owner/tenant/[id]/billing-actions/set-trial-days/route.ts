import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { setTenantTrialRemainingDaysByOwner } from "@/services/platform/owner-billing-actions.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      daysRemaining?: number;
      reason?: string;
    };
    const daysRemaining =
      typeof body.daysRemaining === "number"
        ? body.daysRemaining
        : Number.parseInt(String(body.daysRemaining ?? ""), 10);
    if (!Number.isFinite(daysRemaining) || daysRemaining < 0) {
      return NextResponse.json({ error: "daysRemaining inválido" }, { status: 400 });
    }
    await setTenantTrialRemainingDaysByOwner({
      platformUser,
      organizationId: id,
      daysRemaining,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}
