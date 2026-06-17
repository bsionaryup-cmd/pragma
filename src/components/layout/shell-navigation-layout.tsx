"use client";

import { DashboardNavigation } from "@/components/layout/dashboard-navigation";
import { MobileDashboardHeader } from "@/components/layout/mobile-dashboard-header";
import { useShellNavigationMode } from "@/components/layout/use-shell-navigation-mode";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import type { NavItem, NavModule } from "@/lib/navigation";

type ShellNavigationLayoutProps = {
  navModules: NavModule[];
  settingsItem: NavItem | null;
  user: SidebarUser;
  children: React.ReactNode;
};

export function ShellNavigationLayout({
  navModules,
  settingsItem,
  user,
  children,
}: ShellNavigationLayoutProps) {
  const { useDesktopSidebar } = useShellNavigationMode();

  return (
    <>
      {useDesktopSidebar ? (
        <div className="flex h-full max-h-full min-h-0 shrink-0 self-stretch">
          <DashboardNavigation
            modules={navModules}
            settingsItem={settingsItem}
            user={user}
            className="min-h-0 self-stretch"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!useDesktopSidebar ? (
          <MobileDashboardHeader
            navModules={navModules}
            settingsItem={settingsItem}
            user={user}
          />
        ) : null}
        {children}
      </div>
    </>
  );
}
