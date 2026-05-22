import { cache } from "react";
import { db } from "@/lib/db";
import { currentDbUser, requireDbUser } from "@/lib/auth";
import { BILLING_ACCOUNT_SINGLETON } from "@/modules/billing/domain/constants";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";

export async function resolveBillingAccountIdForUserId(
  userId: string,
): Promise<string | null> {
  const organizationId = await getEffectiveOrganizationIdForUser(userId);

  if (!organizationId) {
    return BILLING_ACCOUNT_SINGLETON;
  }

  const account = await db.billingAccount.findUnique({
    where: { organizationId },
    select: { id: true },
  });

  return account?.id ?? BILLING_ACCOUNT_SINGLETON;
}

export async function resolveBillingAccountForUserId(userId: string) {
  const billingAccountId = await resolveBillingAccountIdForUserId(userId);
  if (!billingAccountId) return null;

  return db.billingAccount.findUnique({
    where: { id: billingAccountId },
  });
}

export const getCurrentBillingAccountId = cache(async (): Promise<string> => {
  const user = await currentDbUser();
  if (!user) return BILLING_ACCOUNT_SINGLETON;

  const organizationId = await getEffectiveOrganizationIdForUser(user.id);
  if (organizationId) {
    const account = await ensureOrganizationBillingAccount(organizationId);
    return account.id;
  }

  const legacyId = await resolveBillingAccountIdForUserId(user.id);
  return legacyId ?? BILLING_ACCOUNT_SINGLETON;
});

export const requireBillingAccountId = cache(async (): Promise<string> => {
  const user = await requireDbUser();

  const organizationId = await getEffectiveOrganizationIdForUser(user.id);
  if (organizationId) {
    const account = await ensureOrganizationBillingAccount(organizationId);
    return account.id;
  }

  const legacyId = await resolveBillingAccountIdForUserId(user.id);
  if (!legacyId) {
    throw new Error("Cuenta de facturación no encontrada");
  }
  return legacyId;
});
