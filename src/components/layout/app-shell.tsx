import { cookies } from "next/headers";

import { Sidebar } from "@/components/layout/sidebar";
import { ThemedMainContent } from "@/components/layout/themed-main-content";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import { THEME_STORAGE_KEY } from "@/lib/constants";
import { resolveThemeFromCookies } from "@/lib/theme";
import type { NavItem } from "@/lib/navigation";

type AppShellProps = {
  children: React.ReactNode;
  navItems: NavItem[];
  settingsItem: NavItem | null;
  user: SidebarUser;
};

export async function AppShell({
  children,
  navItems,
  settingsItem,
  user,
}: AppShellProps) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_STORAGE_KEY)?.value;
  const resolvedCookie = cookieStore.get("pragma-theme-resolved")?.value;
  const { resolved: initialResolved } = resolveThemeFromCookies(
    themeCookie,
    resolvedCookie,
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      <Sidebar items={navItems} settingsItem={settingsItem} user={user} />
      <ThemedMainContent initialResolved={initialResolved}>
        {children}
      </ThemedMainContent>
    </div>
  );
}
