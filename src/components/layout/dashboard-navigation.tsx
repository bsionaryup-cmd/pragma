"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
};

export function DashboardNavigation({
  modules,
  settingsItem,
  user,
  className,
  onNavigate,
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pinnedModuleId, setPinnedModuleId] = useState<string | null>(null);
  const [suppressedGroupId, setSuppressedGroupId] = useState<string | null>(null);

  useEffect(() => {
    setPinnedModuleId(readPinnedNavGroupId());
    setSuppressedGroupId(readSuppressedNavGroupId());
  }, []);

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
      activeGroupId !== module.id &&
      module.navigateOnOpen !== false &&
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
        openModuleId={openModuleId}
        isModuleStrongActive={isModuleStrongActive}
        onGroupClick={handleGroupClick}
        onMainLinkNavigate={handleMainLinkNavigate}
        onNavigate={onNavigate}
      />
      <ContextualSubSidebar
        module={openModule}
        onClose={handleCloseSubSidebar}
        onNavigate={onNavigate}
      />
    </div>
  );
}
