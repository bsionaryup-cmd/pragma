import { cache } from "react";
import type { BillingAccount } from "@prisma/client";
import { BillingSubscriptionStatus } from "@prisma/client";
import type { BillingAccessSnapshot } from "@/lib/billing/billing-access";
import {
  getBillingAccessSnapshot,
  getBillingAccountSafe,
} from "@/services/billing/billing.service";

const EXPIRY_NOTICE_DAYS = 5;

export type SubscriptionExpiryNotice = {
  daysRemaining: number;
  message: string;
};

export function buildSubscriptionExpiryNotice(
  access: BillingAccessSnapshot,
  account: Pick<BillingAccount, "currentPeriodEnd"> | null,
): SubscriptionExpiryNotice | null {
  const deadline =
    access.status === BillingSubscriptionStatus.TRIAL
      ? access.trialEndsAt
        ? new Date(access.trialEndsAt)
        : null
      : account?.currentPeriodEnd ?? null;

  if (!deadline) return null;

  const msRemaining = deadline.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  if (daysRemaining > EXPIRY_NOTICE_DAYS || daysRemaining < 0) {
    return null;
  }

  const dayLabel = daysRemaining === 1 ? "día" : "días";

  return {
    daysRemaining,
    message: `La suscripción vence en ${daysRemaining} ${dayLabel}. Contacta al administrador.`,
  };
}

export const getSubscriptionExpiryNotice = cache(
  async (): Promise<SubscriptionExpiryNotice | null> => {
    const [access, account] = await Promise.all([
      getBillingAccessSnapshot(),
      getBillingAccountSafe(),
    ]);

    return buildSubscriptionExpiryNotice(access, account);
  },
);
