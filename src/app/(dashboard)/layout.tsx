import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AirbnbAutoSyncLazy } from "@/components/airbnb/airbnb-auto-sync-lazy";
import { DashboardDataRefreshLazy } from "@/components/dashboard/dashboard-data-refresh-lazy";
import { SupportBubbleLazy } from "@/components/support/support-bubble-lazy";
import { DashboardBanners } from "@/components/billing/dashboard-banners";
import { AppShell } from "@/components/layout/app-shell";
import { OwnerShellHeader } from "@/components/owner/owner-shell-header";
import { I18nProvider } from "@/components/providers/i18n-provider";
import {
  enforceTenantDashboardAccess,
  PlatformImpersonationBanner,
} from "@/components/platform/platform-dashboard-guards";
import { hasPermission, requireDbUser } from "@/lib/auth";
import { displayRoleLabel } from "@/lib/auth/role-labels";
import { getDictionary } from "@/i18n/get-dictionary";
import { getServerLocale } from "@/i18n/locale.server";
import { BillingPaywallNotice } from "@/components/billing/billing-paywall-notice";
import { enforceBillingAccessForDashboard } from "@/lib/billing/require-billing-route";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getOrganizationPlanContextForUser } from "@/lib/billing/organization-plan";
import {
  getNavigationModulesForRole,
  getSettingsNavItem,
} from "@/lib/navigation";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { userNeedsOnboarding } from "@/services/onboarding/onboarding.service";
import type { AppUserRole } from "@/types/auth";

const AIRBNB_AUTO_SYNC_PREFIXES = [
  "/panel",
  "/calendar",
  "/properties",
  "/reservations",
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, locale, headerStore] = await Promise.all([
    requireDbUser(),
    getServerLocale(),
    headers(),
  ]);
  const pathname =
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("next-url") ??
    "";

  const [dictionary, tenantContext, planContext] = await Promise.all([
    getDictionary(locale),
    enforceTenantDashboardAccess(user, pathname),
    getOrganizationPlanContextForUser(user.id),
  ]);

  if (!isSuperAdminOwner(user) && userNeedsOnboarding(user)) {
    redirect("/onboarding");
  }

  const billingAccess = !isSuperAdminOwner(user)
    ? await getBillingAccessSnapshot()
    : null;
  const billingPaywall = Boolean(billingAccess?.locked);

  if (billingPaywall) {
    await enforceBillingAccessForDashboard(pathname);
  }

  const role = tenantContext.effectiveRole as AppUserRole;
  const isBillingAdmin = hasPermission(role, "billing:manage");
  const navModules = billingPaywall
    ? []
    : getNavigationModulesForRole(role, planContext?.plan);
  const settingsItem = billingPaywall ? null : getSettingsNavItem(role);
  const canSyncAirbnb =
    !billingPaywall &&
    hasPermission(role, "properties:write") &&
    AIRBNB_AUTO_SYNC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isPlatformOwnerSession =
    isSuperAdminOwner(user) && Boolean(user.organizationId);

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <div
        className={
          isPlatformOwnerSession
            ? "flex h-dvh flex-col overflow-hidden"
            : undefined
        }
      >
        {isPlatformOwnerSession ? (
          <OwnerShellHeader
            user={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              imageUrl: user.imageUrl,
            }}
            hasOwnOrganization
            context="tenant-self"
          />
        ) : null}
        <AppShell
          className={
            isPlatformOwnerSession ? "min-h-0 flex-1 max-h-none" : undefined
          }
          paywallMode={billingPaywall}
          navModules={navModules}
          settingsItem={settingsItem}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            imageUrl: user.imageUrl,
            role,
            roleLabel: displayRoleLabel(user, role),
          }}
        >
          {billingPaywall && billingAccess ? (
            <BillingPaywallNotice access={billingAccess} isAdmin={isBillingAdmin} />
          ) : (
            <>
              <Suspense fallback={null}>
                <PlatformImpersonationBanner />
              </Suspense>
              <Suspense fallback={null}>
                <DashboardBanners user={user} />
              </Suspense>
            </>
          )}
          <AirbnbAutoSyncLazy enabled={canSyncAirbnb} />
          {!billingPaywall ? <DashboardDataRefreshLazy /> : null}
          {children}
          {!billingPaywall ? (
            <SupportBubbleLazy routeContext={pathname || undefined} />
          ) : null}
        </AppShell>
      </div>
    </I18nProvider>
  );
}
