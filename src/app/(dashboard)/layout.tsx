import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AirbnbAutoSyncLazy } from "@/components/airbnb/airbnb-auto-sync-lazy";
import { DashboardBanners } from "@/components/billing/dashboard-banners";
import { AppShell } from "@/components/layout/app-shell";
import { I18nProvider } from "@/components/providers/i18n-provider";
import {
  enforceTenantDashboardAccess,
  PlatformImpersonationBanner,
} from "@/components/platform/platform-dashboard-guards";
import { hasPermission, requireDbUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/get-dictionary";
import { getServerLocale } from "@/i18n/locale.server";
import {
  getMainNavigationForRole,
  getSettingsNavItem,
} from "@/lib/navigation";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { userNeedsOnboarding } from "@/services/onboarding/onboarding.service";
import type { AppUserRole } from "@/types/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, locale, dictionary] = await Promise.all([
    requireDbUser(),
    getServerLocale(),
    getServerLocale().then((l) => getDictionary(l)),
  ]);

  const tenantContext = await enforceTenantDashboardAccess(user);

  if (!isSuperAdminOwner(user) && userNeedsOnboarding(user)) {
    redirect("/onboarding");
  }

  const role = tenantContext.effectiveRole as AppUserRole;
  const navItems = getMainNavigationForRole(role);
  const settingsItem = getSettingsNavItem(role);
  const canSyncAirbnb = hasPermission(role, "properties:write");

  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <AppShell
        navItems={navItems}
        settingsItem={settingsItem}
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          imageUrl: user.imageUrl,
          role,
        }}
      >
        <Suspense fallback={null}>
          <PlatformImpersonationBanner />
        </Suspense>
        <Suspense fallback={null}>
          <DashboardBanners user={user} />
        </Suspense>
        <AirbnbAutoSyncLazy enabled={canSyncAirbnb} />
        {children}
      </AppShell>
    </I18nProvider>
  );
}
