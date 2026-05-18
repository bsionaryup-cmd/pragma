import { AirbnbAutoSync } from "@/components/airbnb/airbnb-auto-sync";
import { AppShell } from "@/components/layout/app-shell";
import { hasPermission, requireDbUser } from "@/lib/auth";
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
  const navItems = getMainNavigationForRole(role);
  const settingsItem = getSettingsNavItem(role);
  const canSyncAirbnb = hasPermission(role, "properties:write");

  return (
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
      <AirbnbAutoSync enabled={canSyncAirbnb} />
      {children}
    </AppShell>
  );
}
