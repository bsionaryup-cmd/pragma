import "server-only";

import type { User } from "@prisma/client";
import { OrganizationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildTrialBillingMetadata } from "@/lib/billing/trial-eligibility-metadata";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { cancelOrganizationSubscription } from "@/modules/billing/services/subscription-cancel.service";

export async function updateTenantNameByOwner(input: {
  platformUser: User;
  organizationId: string;
  name: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Nombre inválido");

  const org = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!org) throw new Error("Tenant no encontrado");
  if (org.deletedAt) throw new Error("Tenant eliminado (soft delete)");
  if (org.name === name) return;

  await db.organization.update({
    where: { id: input.organizationId },
    data: { name },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "tenant_rename",
    targetTenantId: input.organizationId,
    previousState: { name: org.name },
    newState: { name },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function softDeleteTenantByOwner(input: {
  platformUser: User;
  organizationId: string;
  reason: string;
  allowRetrial?: boolean;
}) {
  assertSuperAdminOwner(input.platformUser);

  const org = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true, deletedAt: true, status: true },
  });
  if (!org) throw new Error("Tenant no encontrado");
  if (org.deletedAt) return;

  const billing = await db.billingAccount.findUnique({
    where: { organizationId: input.organizationId },
    select: { id: true },
  });

  const owner = await db.user.findFirst({
    where: { organizationId: input.organizationId, isAccountOwner: true },
    select: { email: true },
  });

  if (billing?.id && input.allowRetrial) {
    await db.billingAccount.update({
      where: { id: billing.id },
      data: {
        trialRetrialPolicy: "ALLOW",
        metadata: owner?.email ? buildTrialBillingMetadata(owner.email) : undefined,
      },
    });
  }

  await db.$transaction([
    db.organization.update({
      where: { id: input.organizationId },
      data: {
        deletedAt: new Date(),
        deletedReason: input.reason.trim().slice(0, 400),
        status: OrganizationStatus.SUSPENDED,
        suspendedAt: new Date(),
      },
    }),
    db.user.updateMany({
      where: { organizationId: input.organizationId, isAccountOwner: false },
      data: { isActive: false, deletedAt: new Date() },
    }),
  ]);

  if (billing?.id) {
    await cancelOrganizationSubscription({
      billingAccountId: billing.id,
      actorId: input.platformUser.id,
      reason: `owner_soft_delete:${input.reason.trim().slice(0, 120)}`,
    });
  }

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "tenant_soft_delete",
    targetTenantId: input.organizationId,
    previousState: { deletedAt: org.deletedAt, status: org.status },
    newState: { deletedAt: new Date().toISOString(), status: OrganizationStatus.SUSPENDED },
    metadata: { reason: input.reason, allowRetrial: Boolean(input.allowRetrial) },
  });
}

