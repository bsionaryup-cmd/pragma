import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { setTenantPropertySlotsByOwner } from "@/services/platform/owner-billing-actions.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { propertySlots?: number; reason?: string };
    if (!Number.isFinite(body.propertySlots)) {
      return NextResponse.json({ error: "propertySlots inválido" }, { status: 400 });
    }
    await setTenantPropertySlotsByOwner({
      platformUser,
      organizationId: id,
      propertySlots: body.propertySlots!,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

