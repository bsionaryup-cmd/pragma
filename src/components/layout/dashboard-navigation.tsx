"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ContextualSubSidebar } from "@/components/layout/contextual-sub-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import {
  readSuppressedNavGroupId,
  writePinnedNavGroupId,
  writeSuppressedNavGroupId,
} from "@/components/layout/use-nav-persistence";
import {
  getActiveNavGroupId,
  isNavGroupModule,
  isNavModuleActive,
  type NavGroupModule,
  type NavItem,
  type NavModule,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { MAIN_SIDEBAR_WIDTH_CLASS } from "@/components/layout/nav-layout.constants";

type DashboardNavigationProps = {
  modules: NavModule[];
  settingsItem: NavItem | null;
  user: SidebarUser;
  className?: string;
  onNavigate?: () => void;
  /** Menú en sheet (PWA/tablet): sin sub-sidebar lateral, navega al abrir grupo. */
  overlay?: boolean;
};

export function DashboardNavigation({
  modules,
  settingsItem,
  user,
  className,
  onNavigate,
  overlay = false,
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [suppressedGroupId, setSuppressedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (overlay) return;
    setSuppressedGroupId(readSuppressedNavGroupId());
    writePinnedNavGroupId(null);
  }, [overlay]);

  const activeGroupId = useMemo(
    () => getActiveNavGroupId(pathname, modules),
    [modules, pathname],
  );

  useEffect(() => {
    setSuppressedGroupId((current) => {
      if (!current || current === activeGroupId) return current;
      writeSuppressedNavGroupId(null);
      return null;
    });
  }, [activeGroupId]);

  /** Sub-sidebar solo en rutas de un grupo con submenú (Finanzas, Ajustes). */
  const openModuleId =
    activeGroupId && activeGroupId !== suppressedGroupId ? activeGroupId : null;

  const openModule = useMemo(() => {
    const found =
      modules.find(
        (module): module is NavGroupModule =>
          isNavGroupModule(module) && module.id === openModuleId,
      ) ?? null;
    return found?.children.length ? found : null;
  }, [modules, openModuleId]);

  const isModuleStrongActive = useCallback(
    (module: NavModule) => {
      if (isNavGroupModule(module)) {
        if (openModuleId) return openModuleId === module.id;
        return activeGroupId === module.id;
      }

      return openModuleId === null && isNavModuleActive(pathname, module);
    },
    [activeGroupId, openModuleId, pathname],
  );

  function handleGroupClick(module: NavGroupModule) {
    if (overlay) {
      router.push(module.href);
      onNavigate?.();
      return;
    }

    if (openModuleId === module.id) {
      setSuppressedGroupId(module.id);
      writeSuppressedNavGroupId(module.id);
      return;
    }

    setSuppressedGroupId(null);
    writeSuppressedNavGroupId(null);

    if (activeGroupId !== module.id) {
      router.push(module.href);
      onNavigate?.();
    }
  }

  function handleMainLinkNavigate() {
    setSuppressedGroupId(null);
    writePinnedNavGroupId(null);
    writeSuppressedNavGroupId(null);
    onNavigate?.();
  }

  function handleCloseSubSidebar() {
    if (activeGroupId) {
      setSuppressedGroupId(activeGroupId);
      writeSuppressedNavGroupId(activeGroupId);
      return;
    }
    writePinnedNavGroupId(null);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 shrink-0 self-stretch items-stretch",
        overlay && MAIN_SIDEBAR_WIDTH_CLASS,
        className,
      )}
    >
      <Sidebar
        modules={modules}
        settingsItem={settingsItem}
        user={user}
        forceExpanded={overlay}
        openModuleId={overlay ? null : openModuleId}
        isModuleStrongActive={isModuleStrongActive}
        onGroupClick={handleGroupClick}
        onMainLinkNavigate={handleMainLinkNavigate}
        onNavigate={onNavigate}
      />
      {!overlay ? (
        <ContextualSubSidebar
          module={openModule}
          onClose={handleCloseSubSidebar}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  );
}
