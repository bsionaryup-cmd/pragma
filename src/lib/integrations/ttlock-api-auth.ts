import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  resolveRequestContextFromRequest,
  type TTLockRequestContext,
} from "@/lib/integrations/ttlock-config";
import { getUserByClerkId } from "@/services/users/user.service";
import { hasPermission } from "@/lib/auth/permissions";
import type { AppUserRole, AuthContext } from "@/types/auth";

export async function requireTTLockApiAdmin(
  request: Request,
): Promise<
  | { auth: AuthContext; request: TTLockRequestContext }
  | NextResponse
> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = await getUserByClerkId(userId);
  if (!user?.isActive || !hasPermission(user.role as AppUserRole, "integrations:manage")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return {
    auth: {
      dbUserId: user.id,
      clerkId: user.clerkId,
      email: user.email,
      role: user.role,
      isAccountOwner: user.isAccountOwner,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
    request: resolveRequestContextFromRequest(request),
  };
}

export function isAuthErrorResponse(
  value: { auth: AuthContext; request: TTLockRequestContext } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
