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
      <Sidebar items={navItems} settingsItem={settingsItem} user={user} />
      <ThemedMainContent>{children}</ThemedMainContent>
    </div>
  );
}
