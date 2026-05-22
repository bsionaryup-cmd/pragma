import { BillingLockBanner } from "@/components/billing/billing-lock-banner";
import { SubscriptionExpiryNoticeBanner } from "@/components/billing/subscription-expiry-notice-banner";
import { StartTrialBanner } from "@/components/billing/start-trial-banner";
import { TrialBanner } from "@/components/billing/trial-banner";
import { hasPermission } from "@/lib/auth";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { userNeedsOnboarding } from "@/services/onboarding/onboarding.service";
import type { AppUserRole } from "@/types/auth";
import type { User } from "@prisma/client";
import { BillingSubscriptionStatus } from "@prisma/client";

type DashboardBannersProps = {
  user: User;
};

/** Billing/onboarding banners — streamed so module pages paint first. */
export async function DashboardBanners({ user }: DashboardBannersProps) {
  const role = user.role as AppUserRole;
  const isAdmin = hasPermission(role, "billing:manage");
  const needsTrialSetup = userNeedsOnboarding(user);
  const billingAccess = await getBillingAccessSnapshot();
  const showTrialBanner =
    !needsTrialSetup &&
    billingAccess.status === BillingSubscriptionStatus.TRIAL &&
    !billingAccess.locked;

  return (
    <>
      {needsTrialSetup && isAdmin ? <StartTrialBanner /> : null}
      {showTrialBanner ? (
        <TrialBanner
          trialEndsAt={billingAccess.trialEndsAt}
          isAdmin={isAdmin}
        />
      ) : null}
      {!isAdmin ? <SubscriptionExpiryNoticeBanner /> : null}
      <BillingLockBanner access={billingAccess} isAdmin={isAdmin} />
    </>
  );
}
