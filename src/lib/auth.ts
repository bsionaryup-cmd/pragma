import { auth, currentUser } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
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
import type { AppUserRole, AuthContext, SessionUser } from "@/types/auth";
import {
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";

export type { Permission } from "@/lib/auth/permissions";
export { hasPermission, getPermissionsForRole } from "@/lib/auth/permissions";

const LOGIN_TOUCH_INTERVAL_MS = 30 * 60 * 1000;

type ClerkPublicMetadata = {
  role?: AppUserRole;
  dbUserId?: string;
};

function readPublicMetadata(sessionClaims: unknown): ClerkPublicMetadata | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;

  const claims = sessionClaims as Record<string, unknown>;
  const raw =
    claims.publicMetadata ?? claims.public_metadata ?? claims.metadata;

  if (!raw || typeof raw !== "object") return undefined;
  return raw as ClerkPublicMetadata;
}

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
      await syncClerkPublicMetadata(userId, {
        role: dbUser.role as AppUserRole,
        dbUserId: dbUser.id,
      });
    }

    if (shouldTouchLastLogin(dbUser.lastLoginAt)) {
      return db.user.update({
        where: { id: dbUser.id },
        data: { lastLoginAt: new Date() },
      });
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

export const requireRole = cache(async (
  allowed: AppUserRole | AppUserRole[],
): Promise<AuthContext> => {
  const user = await requireDbUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  if (!roles.includes(user.role as AppUserRole)) {
    redirect("/unauthorized");
  }

  return toAuthContext(user);
});

export const requirePermission = cache(async (
  permission: Permission,
): Promise<AuthContext> => {
  const user = await requireDbUser();

  if (!hasPermission(user.role as AppUserRole, permission)) {
    redirect("/unauthorized");
  }

  return toAuthContext(user);
});

export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await currentDbUser();
  return user ? toAuthContext(user) : null;
}
