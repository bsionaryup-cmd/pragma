import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AirbnbAutoSyncLazy } from "@/components/airbnb/airbnb-auto-sync-lazy";
import { DashboardDataRefreshLazy } from "@/components/dashboard/dashboard-data-refresh-lazy";
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
import {
  getMainNavigationForRole,
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
  const dictionary = await getDictionary(locale);
  const pathname =
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("next-url") ??
    "";

  const tenantContext = await enforceTenantDashboardAccess(user, pathname);

  if (!isSuperAdminOwner(user) && userNeedsOnboarding(user)) {
    redirect("/onboarding");
  }

  const role = tenantContext.effectiveRole as AppUserRole;
  const navItems = getMainNavigationForRole(role);
  const settingsItem = getSettingsNavItem(role);
  const canSyncAirbnb =
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
          navItems={navItems}
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
          <Suspense fallback={null}>
            <PlatformImpersonationBanner />
          </Suspense>
          <Suspense fallback={null}>
            <DashboardBanners user={user} />
          </Suspense>
          <AirbnbAutoSyncLazy enabled={canSyncAirbnb} />
          <DashboardDataRefreshLazy />
          {children}
        </AppShell>
      </div>
    </I18nProvider>
  );
}
