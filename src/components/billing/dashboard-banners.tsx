import { BillingLockBanner } from "@/components/billing/billing-lock-banner";
import { SubscriptionExpiryNoticeBanner } from "@/components/billing/subscription-expiry-notice-banner";
import { StartTrialBanner } from "@/components/billing/start-trial-banner";
import { TrialBanner } from "@/components/billing/trial-banner";
import { hasPermission } from "@/lib/auth";
import { buildSubscriptionExpiryNotice } from "@/lib/billing/subscription-expiry-notice";
import {
  getBillingAccessSnapshot,
  getBillingAccountSafe,
} from "@/services/billing/billing.service";
import { userNeedsOnboarding } from "@/services/onboarding/onboarding.service";
import type { AppUserRole } from "@/types/auth";
import type { User } from "@prisma/client";
import { BillingSubscriptionStatus } from "@prisma/client";

type DashboardBannersProps = {
  user: User;
};

/** Billing/onboarding banners — streamed so module pages paint first. */
export async function DashboardBanners({ user }: DashboardBannersProps) {
  try {
    const role = user.role as AppUserRole;
    const isAdmin = hasPermission(role, "billing:manage");
    const needsTrialSetup = userNeedsOnboarding(user);
    const [billingAccess, billingAccount] = await Promise.all([
      getBillingAccessSnapshot(),
      getBillingAccountSafe(),
    ]);
    const showTrialBanner =
      !needsTrialSetup &&
      billingAccess.status === BillingSubscriptionStatus.TRIAL &&
      !billingAccess.locked;
    const expiryNotice = !isAdmin
      ? buildSubscriptionExpiryNotice(billingAccess, billingAccount)
      : null;

    return (
      <>
        {needsTrialSetup && isAdmin ? <StartTrialBanner /> : null}
        {showTrialBanner ? (
          <TrialBanner
            trialEndsAt={billingAccess.trialEndsAt}
            isAdmin={isAdmin}
          />
        ) : null}
        {expiryNotice ? <SubscriptionExpiryNoticeBanner notice={expiryNotice} /> : null}
        <BillingLockBanner access={billingAccess} isAdmin={isAdmin} />
      </>
    );
  } catch (error) {
    console.error(
      "[DashboardBanners]",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
