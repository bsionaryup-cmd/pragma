"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { DashboardNavigation } from "@/components/layout/dashboard-navigation";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
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
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 shadow-pragma-soft dark:shadow-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-pragma-mid-gray transition-colors hover:bg-pragma-light-blue/60 hover:text-pragma-black"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>

        <PragmaLogo variant="mark" symbolClassName="h-9 w-9" />

        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          PRAGMA
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw,460px)] gap-0 p-0 sm:max-w-[460px]"
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <DashboardNavigation
            modules={navModules}
            settingsItem={settingsItem}
            user={user}
            overlay
            onNavigate={() => setOpen(false)}
            className="h-full w-full border-0 shadow-none"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
