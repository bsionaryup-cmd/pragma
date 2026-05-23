"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NavItem } from "@/lib/navigation";

type MobileDashboardHeaderProps = {
  navItems: NavItem[];
  settingsItem: NavItem | null;
  user: SidebarUser;
};

export function MobileDashboardHeader({
  navItems,
  settingsItem,
  user,
}: MobileDashboardHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 shadow-pragma-soft lg:hidden dark:shadow-none">
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
          className="w-[min(100vw,280px)] gap-0 p-0 sm:max-w-[280px]"
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <Sidebar
            items={navItems}
            settingsItem={settingsItem}
            user={user}
            forceExpanded
            onNavigate={() => setOpen(false)}
            className="h-full w-full border-0 shadow-none"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
