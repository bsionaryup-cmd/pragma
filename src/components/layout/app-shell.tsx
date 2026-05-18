import { Sidebar } from "@/components/layout/sidebar";
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
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar items={navItems} settingsItem={settingsItem} user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
