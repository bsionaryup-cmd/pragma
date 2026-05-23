import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { after } from "next/server";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getUserByClerkId,
  mapClerkUserToPayload,
  syncClerkPublicMetadata,
  upsertUserFromClerk,
} from "@/services/users/user.service";
import { recordLoginActivity } from "@/services/users/login-activity.service";
import { isUserSchemaDriftError } from "@/services/users/user-prisma-guard";
import type { AppUserRole, AuthContext, SessionUser } from "@/types/auth";
import {
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";
import { readPublicMetadata } from "@/lib/auth/session-claims";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";

export type { Permission } from "@/lib/auth/permissions";
export { hasPermission, getPermissionsForRole } from "@/lib/auth/permissions";

const LOGIN_TOUCH_INTERVAL_MS = 30 * 60 * 1000;

type ClerkPublicMetadata = {
  role?: AppUserRole;
  dbUserId?: string;
};

async function fetchClerkUser() {
  try {
    return await currentUser();
  } catch (error) {
    if (isClerkAPIResponseError(error)) {
      console.error("[auth] Clerk API no disponible:", error.errors ?? error.message);
      redirect("/sign-in?clerk_unavailable=1");
    }
    throw error;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await fetchClerkUser();
  if (!user) return null;
  return mapClerkUserToPayload(user);
}

function toAuthContext(user: User): AuthContext {
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

function shouldTouchLastLogin(lastLoginAt: Date | null): boolean {
  if (!lastLoginAt) return true;
  return Date.now() - lastLoginAt.getTime() > LOGIN_TOUCH_INTERVAL_MS;
}

/** Usuario activo en PostgreSQL (sin crear si falta). */
export const currentDbUser = cache(async (): Promise<User | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await getUserByClerkId(userId);
  if (!user?.isActive) return null;
  return user;
});

/** Alias explícito solicitado en roadmap */
export const getCurrentDbUser = currentDbUser;

/** Sesión Clerk + usuario DB sincronizado y login actualizado */
export const requireDbUser = cache(async (): Promise<User> => {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  let dbUser = await getUserByClerkId(userId);

  if (dbUser?.isActive) {
    const metadata = readPublicMetadata(sessionClaims);
    const needsMetadataSync =
      !metadata?.dbUserId ||
      metadata.dbUserId !== dbUser.id ||
      metadata.role !== (dbUser.role as AppUserRole);

    if (needsMetadataSync) {
      const activeUser = dbUser;
      after(() =>
        syncClerkPublicMetadata(userId, {
          role: activeUser.role as AppUserRole,
          dbUserId: activeUser.id,
        }),
      );
    }

    if (shouldTouchLastLogin(dbUser.lastLoginAt)) {
      const headerStore = await headers();
      const forwarded = headerStore.get("x-forwarded-for");
      const ip =
        forwarded?.split(",")[0]?.trim() ||
        headerStore.get("x-real-ip") ||
        null;
      const userAgent = headerStore.get("user-agent");
      const userIdForLogin = dbUser.id;
      const activeUser = dbUser;

      after(async () => {
        try {
          await recordLoginActivity({
            userId: userIdForLogin,
            ipAddress: ip,
            userAgent,
          });
          if (isSuperAdminOwner(activeUser)) {
            await writePlatformAuditLog({
              platformUserId: activeUser.id,
              ownerEmail: activeUser.email,
              action: "owner_login",
            });
          }
        } catch (error) {
          if (!isUserSchemaDriftError(error)) {
            console.warn("[auth] login activity skipped:", error);
          }
        }
        try {
          await db.user.update({
            where: { id: userIdForLogin },
            data: { lastLoginAt: new Date() },
          });
        } catch (error) {
          if (!isUserSchemaDriftError(error)) {
            console.warn("[auth] lastLoginAt touch skipped:", error);
          }
        }
      });

      return dbUser;
    }

    return dbUser;
  }

  if (dbUser && !dbUser.isActive) {
    redirect("/sign-in?inactive=1");
  }

  const clerkUser = await fetchClerkUser();
  if (!clerkUser) redirect("/sign-in");

  if (!dbUser) {
    dbUser = await upsertUserFromClerk(mapClerkUserToPayload(clerkUser), {
      touchLogin: true,
    });
  } else {
    const metadata = clerkUser.publicMetadata as ClerkPublicMetadata | undefined;
    const needsMetadataSync =
      !metadata?.dbUserId ||
      metadata.dbUserId !== dbUser.id ||
      metadata.role !== (dbUser.role as AppUserRole);

    dbUser = await upsertUserFromClerk(mapClerkUserToPayload(clerkUser), {
      touchLogin: true,
      syncClerkMetadata: needsMetadataSync,
    });
  }

  return dbUser;
});

async function resolveEffectiveAuthContext(user: User): Promise<AuthContext> {
  const ctx = await buildTenantContext(user);
  const base = toAuthContext(user);
  return {
    ...base,
    role: ctx.effectiveRole,
  };
}

export const requireRole = cache(async (
  allowed: AppUserRole | AppUserRole[],
): Promise<AuthContext> => {
  const user = await requireDbUser();
  const authContext = await resolveEffectiveAuthContext(user);
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  if (!roles.includes(authContext.role)) {
    redirect("/unauthorized");
  }

  return authContext;
});

export const requirePermission = cache(async (
  permission: Permission,
): Promise<AuthContext> => {
  const user = await requireDbUser();
  const authContext = await resolveEffectiveAuthContext(user);

  if (!hasPermission(authContext.role, permission)) {
    redirect("/unauthorized");
  }

  return authContext;
});

export const requireAnyPermission = cache(async (
  ...permissions: Permission[]
): Promise<AuthContext> => {
  const user = await requireDbUser();
  const authContext = await resolveEffectiveAuthContext(user);

  if (
    !permissions.some((permission) =>
      hasPermission(authContext.role, permission),
    )
  ) {
    redirect("/unauthorized");
  }

  return authContext;
});

export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await currentDbUser();
  return user ? toAuthContext(user) : null;
}
