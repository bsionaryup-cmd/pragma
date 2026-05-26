import { NextResponse } from "next/server";
import { requirePlatformOwnerUser, platformOwnerErrorResponse } from "@/lib/platform/require-platform-owner";
import { inviteTenantUserByOwner } from "@/services/platform/owner-tenant-user-admin.service";
import { UserRole } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const platformUser = await requirePlatformOwnerUser();
    const { id } = await context.params;
    const body = (await request.json()) as { email?: string; role?: string; reason?: string };

    if (!body.email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }
    const role =
      body.role === UserRole.ADMIN || body.role === UserRole.RECEPTIONIST
        ? (body.role as UserRole)
        : UserRole.RECEPTIONIST;

    const result = await inviteTenantUserByOwner({
      platformUser,
      organizationId: id,
      email: body.email,
      role,
      reason: body.reason,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return platformOwnerErrorResponse(error);
  }
}

