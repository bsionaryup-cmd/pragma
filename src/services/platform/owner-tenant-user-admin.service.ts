import "server-only";

import { createClerkClient } from "@clerk/backend";
import type { User, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { syncClerkPublicMetadata } from "@/services/users/user.service";

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY no configurado");
  }
  return createClerkClient({ secretKey });
}

export async function inviteTenantUserByOwner(input: {
  platformUser: User;
  organizationId: string;
  email: string;
  role: UserRole;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Email inválido");

  const org = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("Tenant no encontrado");

  const clerk = clerkClient();
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: {
      pragmaOrgId: input.organizationId,
      pragmaRole: input.role,
      pragmaInvitedBy: input.platformUser.email,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "tenant_user_invite",
    targetTenantId: input.organizationId,
    newState: { email, role: input.role, invitationId: invitation.id },
    metadata: { reason: input.reason ?? "owner_ops" },
  });

  return { invitationId: invitation.id, organizationName: org.name };
}

export async function setTenantUserRoleByOwner(input: {
  platformUser: User;
  organizationId: string;
  userId: string;
  role: UserRole;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);

  const target = await db.user.findFirst({
    where: { id: input.userId, organizationId: input.organizationId },
    select: { id: true, clerkId: true, role: true, email: true, isAccountOwner: true },
  });
  if (!target) throw new Error("Usuario no encontrado");
  if (target.isAccountOwner) {
    throw new Error("No se puede cambiar el rol del owner del tenant");
  }

  if (target.role === input.role) return;

  await db.user.update({
    where: { id: input.userId },
    data: { role: input.role },
  });

  await syncClerkPublicMetadata(target.clerkId, {
    role: input.role,
    dbUserId: target.id,
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "tenant_user_role_change",
    targetTenantId: input.organizationId,
    targetUserId: target.id,
    previousState: { role: target.role },
    newState: { role: input.role },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function setTenantUserActiveByOwner(input: {
  platformUser: User;
  organizationId: string;
  userId: string;
  isActive: boolean;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);

  const target = await db.user.findFirst({
    where: { id: input.userId, organizationId: input.organizationId },
    select: { id: true, isActive: true, email: true, isAccountOwner: true },
  });
  if (!target) throw new Error("Usuario no encontrado");
  if (target.isAccountOwner && !input.isActive) {
    throw new Error("No se puede desactivar al owner del tenant");
  }
  if (target.isActive === input.isActive) return;

  await db.user.update({
    where: { id: target.id },
    data: { isActive: input.isActive },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: input.isActive ? "tenant_user_reactivate" : "tenant_user_deactivate",
    targetTenantId: input.organizationId,
    targetUserId: target.id,
    previousState: { isActive: target.isActive },
    newState: { isActive: input.isActive },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function softDeleteTenantUserByOwner(input: {
  platformUser: User;
  organizationId: string;
  userId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);

  const target = await db.user.findFirst({
    where: { id: input.userId, organizationId: input.organizationId },
    select: { id: true, deletedAt: true, email: true, isAccountOwner: true, isActive: true },
  });
  if (!target) throw new Error("Usuario no encontrado");
  if (target.isAccountOwner) throw new Error("No se puede eliminar al owner del tenant");
  if (target.deletedAt) return;

  await db.user.update({
    where: { id: target.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "tenant_user_soft_delete",
    targetTenantId: input.organizationId,
    targetUserId: target.id,
    previousState: { deletedAt: target.deletedAt, isActive: target.isActive },
    newState: { deletedAt: new Date().toISOString(), isActive: false },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

