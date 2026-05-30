"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ContextualSubSidebar } from "@/components/layout/contextual-sub-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import {
  readPinnedNavGroupId,
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
  const previousPathnameRef = useRef(pathname);
  const [pinnedModuleId, setPinnedModuleId] = useState<string | null>(null);
  const [suppressedGroupId, setSuppressedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (overlay) return;

    let pinned = readPinnedNavGroupId();
    const suppressed = readSuppressedNavGroupId();

    if (getActiveNavGroupId(pathname, modules) === null && pinned !== null) {
      writePinnedNavGroupId(null);
      pinned = null;
    }

    setPinnedModuleId(pinned);
    setSuppressedGroupId(suppressed);
    // Solo restaurar persistencia al montar el shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeGroupId = useMemo(
    () => getActiveNavGroupId(pathname, modules),
    [modules, pathname],
  );

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    if (pathname === previousPathname) return;
    previousPathnameRef.current = pathname;

    // Rutas sueltas (p. ej. /revenue) no deben mantener un submenú de grupo abierto.
    if (getActiveNavGroupId(pathname, modules) !== null) return;

    setPinnedModuleId((current) => {
      if (current === null) return current;
      writePinnedNavGroupId(null);
      return null;
    });
  }, [pathname, modules]);

  useEffect(() => {
    setSuppressedGroupId((current) => {
      if (!current || current === activeGroupId) return current;
      writeSuppressedNavGroupId(null);
      return null;
    });
  }, [activeGroupId]);

  const openModuleId =
    activeGroupId && activeGroupId !== suppressedGroupId
      ? activeGroupId
      : pinnedModuleId;

  const openModule =
    modules.find(
      (module): module is NavGroupModule =>
        isNavGroupModule(module) && module.id === openModuleId,
    ) ?? null;

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

    if (activeGroupId === module.id && openModuleId === module.id) {
      setSuppressedGroupId(module.id);
      setPinnedModuleId(null);
      writeSuppressedNavGroupId(module.id);
      writePinnedNavGroupId(null);
      return;
    }

    const isOpening = openModuleId !== module.id;
    setSuppressedGroupId(null);
    setPinnedModuleId(module.id);
    writeSuppressedNavGroupId(null);
    writePinnedNavGroupId(module.id);

    if (
      isOpening &&
      module.navigateOnOpen === true &&
      module.href !== pathname
    ) {
      router.push(module.href);
      onNavigate?.();
    }
  }

  function handleMainLinkNavigate() {
    setPinnedModuleId(null);
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
    setPinnedModuleId(null);
    writePinnedNavGroupId(null);
  }

  return (
    <div className={cn("flex h-full min-h-0 shrink-0", className)}>
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
