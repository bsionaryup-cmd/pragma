import { AirbnbAutoSync } from "@/components/airbnb/airbnb-auto-sync";
import { BillingLockBanner } from "@/components/billing/billing-lock-banner";
import { AppShell } from "@/components/layout/app-shell";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { hasPermission, requireDbUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/get-dictionary";
import { getServerLocale } from "@/i18n/locale.server";
import {
  getMainNavigationForRole,
  getSettingsNavItem,
} from "@/lib/navigation";
import type { AppUserRole } from "@/types/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDbUser();
  const role = user.role as AppUserRole;
  const locale = await getServerLocale();
  const dictionary = await getDictionary(locale);
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
        }}
      >
        <BillingLockBanner />
        <AirbnbAutoSync enabled={canSyncAirbnb} />
        {children}
      </AppShell>
    </I18nProvider>
  );
}
