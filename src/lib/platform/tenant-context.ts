import "server-only";

import { cache } from "react";
import type { User } from "@prisma/client";
import { PlatformImpersonationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { currentDbUser, requireDbUser } from "@/lib/auth";
import { readImpersonationSessionIdFromCookies } from "@/lib/platform/impersonation-cookie";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import type { AppUserRole } from "@/types/auth";

export type TenantContext = {
  userId: string;
  email: string;
  organizationId: string | null;
  isPlatformOwner: boolean;
  isImpersonating: boolean;
  impersonationSessionId: string | null;
  impersonatedOrganizationId: string | null;
  effectiveRole: AppUserRole;
};

async function loadActiveImpersonationSession(
  platformUserId: string,
  sessionId: string | null,
) {
  if (!sessionId) return null;

  const session = await db.platformImpersonationSession.findFirst({
    where: {
      id: sessionId,
      platformUserId,
      status: PlatformImpersonationStatus.ACTIVE,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      targetOrganizationId: true,
    },
  });

  if (!session) return null;

  const org = await db.organization.findUnique({
    where: { id: session.targetOrganizationId },
    select: { id: true, status: true },
  });

  if (!org) return null;
  return session;
}

export async function buildTenantContext(user: User): Promise<TenantContext> {
  const platformOwner = isSuperAdminOwner(user);
  const sessionId = platformOwner
    ? await readImpersonationSessionIdFromCookies()
    : null;
  const impersonation = platformOwner
    ? await loadActiveImpersonationSession(user.id, sessionId)
    : null;

  const isImpersonating = Boolean(impersonation);
  const impersonatedOrganizationId = impersonation?.targetOrganizationId ?? null;

  return {
    userId: user.id,
    email: user.email,
    organizationId: isImpersonating
      ? impersonatedOrganizationId
      : user.organizationId,
    isPlatformOwner: platformOwner,
    isImpersonating,
    impersonationSessionId: impersonation?.id ?? null,
    impersonatedOrganizationId,
    effectiveRole: isImpersonating ? "ADMIN" : user.role,
  };
}

export const getCurrentTenantContext = cache(async (): Promise<TenantContext | null> => {
  const user = await currentDbUser();
  if (!user) return null;
  return buildTenantContext(user);
});

export const requireTenantContext = cache(async (): Promise<TenantContext> => {
  const user = await requireDbUser();
  return buildTenantContext(user);
});

export async function getEffectiveOrganizationIdForUser(
  userId: string,
): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const ctx = await buildTenantContext(user);
  return ctx.organizationId;
}
