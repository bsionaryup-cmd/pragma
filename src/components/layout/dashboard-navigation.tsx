"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [explicitGroupId, setExplicitGroupId] = useState<string | null>(null);
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
    const previousPathname = previousPathnameRef.current;
    if (pathname === previousPathname) return;
    previousPathnameRef.current = pathname;
    setExplicitGroupId(null);
  }, [pathname]);

  useEffect(() => {
    setSuppressedGroupId((current) => {
      if (!current || current === activeGroupId) return current;
      writeSuppressedNavGroupId(null);
      return null;
    });
  }, [activeGroupId]);

  const routeGroupId =
    activeGroupId && activeGroupId !== suppressedGroupId ? activeGroupId : null;

  /** Ruta activa primero; clic explícito en otro grupo prevalece hasta cambiar URL. */
  const openModuleId =
    explicitGroupId && explicitGroupId !== routeGroupId
      ? explicitGroupId
      : routeGroupId;

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

    if (openModuleId === module.id) {
      setExplicitGroupId(null);
      if (routeGroupId === module.id) {
        setSuppressedGroupId(module.id);
        writeSuppressedNavGroupId(module.id);
      }
      return;
    }

    setSuppressedGroupId(null);
    writeSuppressedNavGroupId(null);
    setExplicitGroupId(module.id);

    const switchingAwayFromRouteGroup =
      routeGroupId != null && module.id !== routeGroupId;
    const shouldNavigate =
      module.href !== pathname &&
      (module.navigateOnOpen === true || switchingAwayFromRouteGroup);

    if (shouldNavigate) {
      router.push(module.href);
      onNavigate?.();
    }
  }

  function handleMainLinkNavigate() {
    setExplicitGroupId(null);
    setSuppressedGroupId(null);
    writePinnedNavGroupId(null);
    writeSuppressedNavGroupId(null);
    onNavigate?.();
  }

  function handleCloseSubSidebar() {
    setExplicitGroupId(null);
    if (activeGroupId) {
      setSuppressedGroupId(activeGroupId);
      writeSuppressedNavGroupId(activeGroupId);
      return;
    }
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
