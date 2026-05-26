import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { softDeleteTenantUserByOwner } from "@/services/platform/owner-tenant-user-admin.service";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id, userId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };

    await softDeleteTenantUserByOwner({
      platformUser,
      organizationId: id,
      userId,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

