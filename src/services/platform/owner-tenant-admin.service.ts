import {
  BillingPlanCode,
  BillingSubscriptionStatus,
  type User,
} from "@prisma/client";
import { db } from "@/lib/db";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";

export async function updateTenantPlan(
  platformUser: User,
  targetOrganizationId: string,
  plan: BillingPlanCode,
): Promise<void> {
  assertSuperAdminOwner(platformUser);

  const account = await ensureOrganizationBillingAccount(targetOrganizationId);
  const previousPlan = account.plan;

  if (previousPlan === plan) return;

  await db.billingAccount.update({
    where: { id: account.id },
    data: { plan },
  });

  await writePlatformAuditLog({
    platformUserId: platformUser.id,
    ownerEmail: platformUser.email,
    action: "plan_change",
    targetTenantId: targetOrganizationId,
    previousState: { plan: previousPlan },
    newState: { plan },
  });
}

export async function updateTenantBillingStatus(
  platformUser: User,
  targetOrganizationId: string,
  status: BillingSubscriptionStatus,
): Promise<void> {
  assertSuperAdminOwner(platformUser);

  const account = await ensureOrganizationBillingAccount(targetOrganizationId);
  const previousStatus = account.status;

  if (previousStatus === status) return;

  await db.billingAccount.update({
    where: { id: account.id },
    data: { status },
  });

  await writePlatformAuditLog({
    platformUserId: platformUser.id,
    ownerEmail: platformUser.email,
    action: "billing_change",
    targetTenantId: targetOrganizationId,
    previousState: { status: previousStatus },
    newState: { status },
  });
}
