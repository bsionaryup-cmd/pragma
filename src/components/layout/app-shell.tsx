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
  /** Sin menú lateral: solo pantalla de pago por suscripción vencida. */
  paywallMode?: boolean;
};

export function AppShell({
  children,
  navModules,
  settingsItem,
  user,
  className,
  paywallMode = false,
}: AppShellProps) {
  /** Owner impersonation shell: parent flex column already constrains height. */
  const shellUsesParentHeight =
    typeof className === "string" && /\bflex-1\b/.test(className);

  if (paywallMode) {
    return (
      <div
        className={cn(
          "flex h-dvh max-h-dvh flex-col overflow-hidden bg-background",
          className,
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ThemedMainContent>{children}</ThemedMainContent>
        </div>
      </div>
    );
  }

  return (
    <NovedadesUnreadProvider>
      <div
        className={cn(
          "flex overflow-hidden bg-surface-alt",
          shellUsesParentHeight ? "h-full min-h-0" : "h-dvh max-h-dvh",
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
