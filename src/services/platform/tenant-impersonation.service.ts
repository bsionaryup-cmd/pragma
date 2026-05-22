import {
  OrganizationStatus,
  PlatformImpersonationStatus,
  type User,
} from "@prisma/client";
import { db } from "@/lib/db";
import { PLATFORM_IMPERSONATION_TTL_MS } from "@/lib/platform/constants";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import {
  getRequestAuditMeta,
  writePlatformAuditLog,
} from "@/services/platform/platform-audit.service";

export async function startTenantImpersonation(
  platformUser: User,
  targetOrganizationId: string,
): Promise<{ sessionId: string; organizationName: string }> {
  assertSuperAdminOwner(platformUser);

  const org = await db.organization.findUnique({
    where: { id: targetOrganizationId },
    select: { id: true, name: true, status: true },
  });
  if (!org) {
    throw new Error("Tenant no encontrado");
  }
  if (org.status === OrganizationStatus.SUSPENDED) {
    throw new Error("No se puede acceder a un tenant suspendido");
  }

  await db.platformImpersonationSession.updateMany({
    where: {
      platformUserId: platformUser.id,
      status: PlatformImpersonationStatus.ACTIVE,
    },
    data: {
      status: PlatformImpersonationStatus.ENDED,
      endedAt: new Date(),
      endReason: "replaced_by_new_session",
    },
  });

  const meta = await getRequestAuditMeta();
  const expiresAt = new Date(Date.now() + PLATFORM_IMPERSONATION_TTL_MS);

  const session = await db.platformImpersonationSession.create({
    data: {
      platformUserId: platformUser.id,
      targetOrganizationId,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceLabel: meta.deviceLabel,
    },
  });

  await writePlatformAuditLog({
    platformUserId: platformUser.id,
    ownerEmail: platformUser.email,
    action: "impersonation_start",
    targetTenantId: targetOrganizationId,
    newState: { sessionId: session.id, expiresAt: expiresAt.toISOString() },
  });

  return { sessionId: session.id, organizationName: org.name };
}

export async function endTenantImpersonation(
  platformUser: User,
  sessionId: string,
  reason = "manual_exit",
): Promise<void> {
  assertSuperAdminOwner(platformUser);

  const session = await db.platformImpersonationSession.findFirst({
    where: {
      id: sessionId,
      platformUserId: platformUser.id,
      status: PlatformImpersonationStatus.ACTIVE,
    },
  });

  if (!session) return;

  await db.platformImpersonationSession.update({
    where: { id: session.id },
    data: {
      status: PlatformImpersonationStatus.ENDED,
      endedAt: new Date(),
      endReason: reason,
    },
  });

  await writePlatformAuditLog({
    platformUserId: platformUser.id,
    ownerEmail: platformUser.email,
    action: "impersonation_end",
    targetTenantId: session.targetOrganizationId,
    previousState: { sessionId: session.id },
    metadata: { reason },
  });
}

export async function suspendTenant(
  platformUser: User,
  targetOrganizationId: string,
): Promise<void> {
  assertSuperAdminOwner(platformUser);

  const org = await db.organization.findUnique({
    where: { id: targetOrganizationId },
  });
  if (!org) throw new Error("Tenant no encontrado");

  const previousStatus = org.status;
  await db.organization.update({
    where: { id: targetOrganizationId },
    data: {
      status: OrganizationStatus.SUSPENDED,
      suspendedAt: new Date(),
    },
  });

  await writePlatformAuditLog({
    platformUserId: platformUser.id,
    ownerEmail: platformUser.email,
    action: "tenant_suspend",
    targetTenantId: targetOrganizationId,
    previousState: { status: previousStatus },
    newState: { status: OrganizationStatus.SUSPENDED },
  });
}

export async function reactivateTenant(
  platformUser: User,
  targetOrganizationId: string,
): Promise<void> {
  assertSuperAdminOwner(platformUser);

  const org = await db.organization.findUnique({
    where: { id: targetOrganizationId },
  });
  if (!org) throw new Error("Tenant no encontrado");

  const previousStatus = org.status;
  await db.organization.update({
    where: { id: targetOrganizationId },
    data: {
      status: OrganizationStatus.ACTIVE,
      suspendedAt: null,
    },
  });

  await writePlatformAuditLog({
    platformUserId: platformUser.id,
    ownerEmail: platformUser.email,
    action: "tenant_reactivate",
    targetTenantId: targetOrganizationId,
    previousState: { status: previousStatus },
    newState: { status: OrganizationStatus.ACTIVE },
  });
}
