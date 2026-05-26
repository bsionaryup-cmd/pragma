import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { setTenantUserRoleByOwner } from "@/services/platform/owner-tenant-user-admin.service";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id, userId } = await context.params;
    const body = (await request.json()) as { role?: string; reason?: string };

    if (!body.role || !(body.role in UserRole)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    await setTenantUserRoleByOwner({
      platformUser,
      organizationId: id,
      userId,
      role: body.role as UserRole,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

