import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  resolveRequestContextFromRequest,
  resolveTTLockAppRedirectUrl,
  type TTLockRequestContext,
} from "@/lib/integrations/ttlock-config";
import {
  getUserByClerkId,
  mapClerkUserToPayload,
  upsertUserFromClerk,
} from "@/services/users/user.service";
import { hasPermission } from "@/lib/auth/permissions";
import type { AppUserRole, AuthContext } from "@/types/auth";

type RequireTTLockApiAdminOptions = {
  /** Browser navigation: redirect to sign-in / TTLock instead of JSON errors. */
  browser?: boolean;
};

function toAuthContext(user: {
  id: string;
  clerkId: string;
  email: string;
  role: string;
  isAccountOwner: boolean;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}): AuthContext {
  return {
    dbUserId: user.id,
    clerkId: user.clerkId,
    email: user.email,
    role: user.role as AppUserRole,
    isAccountOwner: user.isAccountOwner,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
  };
}

async function resolveActiveDbUser(clerkId: string) {
  const user = await getUserByClerkId(clerkId);
  if (user?.isActive) return user;

  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== clerkId) return user;

  const synced = await upsertUserFromClerk(mapClerkUserToPayload(clerkUser));
  return synced.isActive ? synced : user;
}

export async function requireTTLockApiAdmin(
  request: Request,
  options?: RequireTTLockApiAdminOptions,
): Promise<
  | { auth: AuthContext; request: TTLockRequestContext }
  | NextResponse
> {
  const browser = options?.browser ?? false;
  const { userId } = await auth();

  if (!userId) {
    if (browser) {
      const next = encodeURIComponent("/integrations/ttlock");
      return NextResponse.redirect(
        resolveTTLockAppRedirectUrl(`/sign-in?next=${next}`, request.url),
      );
    }
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = await resolveActiveDbUser(userId);
  if (!user?.isActive) {
    if (browser) {
      return NextResponse.redirect(
        resolveTTLockAppRedirectUrl("/sign-in?inactive=1", request.url),
      );
    }
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!hasPermission(user.role as AppUserRole, "integrations:manage")) {
    if (browser) {
      return NextResponse.redirect(
        resolveTTLockAppRedirectUrl(
          `/integrations/ttlock?error=${encodeURIComponent("No tienes permiso para conectar TTLock. Se requiere rol de administrador.")}`,
          request.url,
        ),
      );
    }
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return {
    auth: toAuthContext(user),
    request: resolveRequestContextFromRequest(request),
  };
}

export function isAuthErrorResponse(
  value: { auth: AuthContext; request: TTLockRequestContext } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
