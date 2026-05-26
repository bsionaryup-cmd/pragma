import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { updateTenantNameByOwner } from "@/services/platform/owner-tenant-admin-ops.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { name?: string; reason?: string };

    if (!body.name) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    await updateTenantNameByOwner({
      platformUser,
      organizationId: id,
      name: body.name,
      reason: body.reason,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

