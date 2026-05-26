import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { setTenantUserActiveByOwner } from "@/services/platform/owner-tenant-user-admin.service";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id, userId } = await context.params;
    const body = (await request.json()) as { isActive?: boolean; reason?: string };

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive inválido" }, { status: 400 });
    }

    await setTenantUserActiveByOwner({
      platformUser,
      organizationId: id,
      userId,
      isActive: body.isActive,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

