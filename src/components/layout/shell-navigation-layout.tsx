"use client";

import { DashboardNavigation } from "@/components/layout/dashboard-navigation";
import { MobileDashboardHeader } from "@/components/layout/mobile-dashboard-header";
import { useStandaloneDisplayMode } from "@/components/layout/use-standalone-display-mode";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import type { NavItem, NavModule } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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
  const isStandalone = useStandaloneDisplayMode();

  return (
    <>
      {!isStandalone ? (
        <div className="hidden h-full max-h-full min-h-0 shrink-0 self-stretch xl:flex">
          <DashboardNavigation
            modules={navModules}
            settingsItem={settingsItem}
            user={user}
            className="min-h-0 self-stretch"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className={cn(!isStandalone && "xl:hidden")}>
          <MobileDashboardHeader
            navModules={navModules}
            settingsItem={settingsItem}
            user={user}
          />
        </div>
        {children}
      </div>
    </>
  );
}
