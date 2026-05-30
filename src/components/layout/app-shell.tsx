import { ShellNavigationLayout } from "@/components/layout/shell-navigation-layout";
import { ThemedMainContent } from "@/components/layout/themed-main-content";
import { NovedadesUnreadProvider } from "@/features/novedades/components/novedades-unread-provider";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import type { NavItem, NavModule } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  navModules: NavModule[];
  settingsItem: NavItem | null;
  user: SidebarUser;
  className?: string;
};

export function AppShell({
  children,
  navModules,
  settingsItem,
  user,
  className,
}: AppShellProps) {
  return (
    <NovedadesUnreadProvider>
      <div
        className={cn(
          "flex h-dvh max-h-dvh overflow-hidden bg-pragma-soft-gray",
          className,
        )}
      >
        <ShellNavigationLayout
          navModules={navModules}
          settingsItem={settingsItem}
          user={user}
        >
          <ThemedMainContent>{children}</ThemedMainContent>
        </ShellNavigationLayout>
      </div>
    </NovedadesUnreadProvider>
  );
}
