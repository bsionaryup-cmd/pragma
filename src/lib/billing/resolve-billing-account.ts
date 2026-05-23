import { cache } from "react";
import { db } from "@/lib/db";
import { currentDbUser, requireDbUser } from "@/lib/auth";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";

export async function resolveBillingAccountIdForUserId(
  userId: string,
): Promise<string | null> {
  const organizationId = await getEffectiveOrganizationIdForUser(userId);

  if (!organizationId) {
    return null;
  }

  const account = await db.billingAccount.findUnique({
    where: { organizationId },
    select: { id: true },
  });

  return account?.id ?? null;
}

export async function resolveBillingAccountForUserId(userId: string) {
  const billingAccountId = await resolveBillingAccountIdForUserId(userId);
  if (!billingAccountId) return null;

  return db.billingAccount.findUnique({
    where: { id: billingAccountId },
  });
}

export const getCurrentBillingAccountId = cache(async (): Promise<string | null> => {
  const user = await currentDbUser();
  if (!user) return null;

  const organizationId = await getEffectiveOrganizationIdForUser(user.id);
  if (!organizationId) {
    return null;
  }

  const account = await ensureOrganizationBillingAccount(organizationId);
  return account.id;
});

export const requireBillingAccountId = cache(async (): Promise<string> => {
  const user = await requireDbUser();

  const organizationId = await getEffectiveOrganizationIdForUser(user.id);
  if (!organizationId) {
    throw new Error("Cuenta de facturación no encontrada");
  }

  const account = await ensureOrganizationBillingAccount(organizationId);
  return account.id;
});
