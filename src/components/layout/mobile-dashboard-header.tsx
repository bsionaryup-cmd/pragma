"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { DashboardNavigation } from "@/components/layout/dashboard-navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import { cn } from "@/lib/utils";
import {
  MAIN_SIDEBAR_WIDTH_CLASS,
} from "@/components/layout/nav-layout.constants";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NavItem, NavModule } from "@/lib/navigation";

type MobileDashboardHeaderProps = {
  navModules: NavModule[];
  settingsItem: NavItem | null;
  user: SidebarUser;
};

export function MobileDashboardHeader({
  navModules,
  settingsItem,
  user,
}: MobileDashboardHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground shadow-pragma-soft dark:shadow-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        <PragmaLogo variant="mark" symbolClassName="h-9 w-9" />

        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          PRAGMA
        </div>

        <ThemeToggle size="sm" align="end" />
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          showCloseButton
          className={cn(
            MAIN_SIDEBAR_WIDTH_CLASS,
            "max-w-[min(100vw,248px)] gap-0 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-pragma-soft dark:shadow-none",
            "[&>button]:top-3 [&>button]:right-3 [&>button]:text-muted-foreground",
          )}
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <DashboardNavigation
            modules={navModules}
            settingsItem={settingsItem}
            user={user}
            overlay
            onNavigate={() => setOpen(false)}
            className={cn(MAIN_SIDEBAR_WIDTH_CLASS, "h-full shrink-0 border-0 shadow-none")}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
