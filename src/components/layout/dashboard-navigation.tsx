"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ContextualSubSidebar } from "@/components/layout/contextual-sub-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
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
  const [pinnedModuleId, setPinnedModuleId] = useState<string | null>(null);
  const [suppressedGroupId, setSuppressedGroupId] = useState<string | null>(null);

  const activeGroupId = useMemo(
    () => getActiveNavGroupId(pathname, modules),
    [modules, pathname],
  );

  const [prevActiveGroupId, setPrevActiveGroupId] = useState(activeGroupId);
  if (activeGroupId !== prevActiveGroupId) {
    setPrevActiveGroupId(activeGroupId);
    setSuppressedGroupId(null);
  }

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
      return;
    }

    setSuppressedGroupId(null);
    setPinnedModuleId((current) => (current === module.id ? null : module.id));
  }

  function handleMainLinkNavigate() {
    setPinnedModuleId(null);
    setSuppressedGroupId(null);
    onNavigate?.();
  }

  function handleCloseSubSidebar() {
    if (activeGroupId) {
      setSuppressedGroupId(activeGroupId);
      return;
    }
    setPinnedModuleId(null);
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
