import { MobileDashboardHeader } from "@/components/layout/mobile-dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemedMainContent } from "@/components/layout/themed-main-content";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import type { NavItem } from "@/lib/navigation";

type AppShellProps = {
  children: React.ReactNode;
  navItems: NavItem[];
  settingsItem: NavItem | null;
  user: SidebarUser;
};

export function AppShell({
  children,
  navItems,
  settingsItem,
  user,
}: AppShellProps) {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-pragma-soft-gray">
      <Sidebar
        items={navItems}
        settingsItem={settingsItem}
        user={user}
        className="hidden lg:flex"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MobileDashboardHeader
          navItems={navItems}
          settingsItem={settingsItem}
          user={user}
        />
        <ThemedMainContent>{children}</ThemedMainContent>
      </div>
    </div>
  );
}
