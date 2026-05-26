import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { softDeleteTenantByOwner } from "@/services/platform/owner-tenant-admin-ops.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { reason?: string };

    const reason = body.reason?.trim();
    if (!reason || reason.length < 3) {
      return NextResponse.json({ error: "Reason requerido (mínimo 3 caracteres)" }, { status: 400 });
    }

    await softDeleteTenantByOwner({
      platformUser,
      organizationId: id,
      reason,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

