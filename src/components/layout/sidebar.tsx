"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NavIcon } from "@/components/layout/nav-icon";
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import { useSidebarCollapsed } from "@/components/layout/use-sidebar-collapsed";
import { useI18n } from "@/components/providers/i18n-provider";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import {
  isNavGroupModule,
  isNavModuleActive,
  type NavGroupModule,
  type NavItem,
  type NavModule,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  modules: NavModule[];
  settingsItem: NavItem | null;
  user: SidebarUser;
  className?: string;
  forceExpanded?: boolean;
  openModuleId?: string | null;
  isModuleStrongActive?: (module: NavModule) => boolean;
  onGroupClick?: (module: NavGroupModule) => void;
  onMainLinkNavigate?: () => void;
  onNavigate?: () => void;
};

function SidebarNavLink({
  item,
  isActive,
  collapsed,
  title,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  title: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      title={collapsed ? title : undefined}
      onClick={() => onNavigate?.()}
      className={cn(
        "group flex items-center rounded-xl text-[14px] font-medium transition-colors duration-150",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "gap-3 px-3 py-2",
        isActive
          ? "bg-pragma-soft-cyan text-pragma-electric ring-1 ring-pragma-cyan/20 shadow-pragma-soft dark:bg-primary/15"
          : "text-pragma-mid-gray hover:bg-white/80 hover:text-pragma-black dark:text-muted-foreground dark:hover:bg-sidebar-accent dark:hover:text-foreground",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
          isActive
            ? "text-pragma-electric"
            : "text-pragma-mid-gray group-hover:text-pragma-electric",
        )}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {item.badge ? (
            <span className="shrink-0 rounded-md bg-pragma-light-blue px-1.5 py-0.5 text-[10px] font-semibold leading-none text-pragma-electric">
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function SidebarNavGroupButton({
  module,
  isStrongActive,
  collapsed,
  title,
  onGroupClick,
}: {
  module: NavGroupModule;
  isStrongActive: boolean;
  collapsed: boolean;
  title: string;
  onGroupClick: (module: NavGroupModule) => void;
}) {
  return (
    <button
      type="button"
      title={collapsed ? title : undefined}
      onClick={() => onGroupClick(module)}
      className={cn(
        "group flex w-full items-center rounded-xl text-[14px] font-medium transition-colors duration-150",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "gap-3 px-3 py-2",
        isStrongActive
          ? "bg-pragma-soft-cyan text-pragma-electric ring-1 ring-pragma-cyan/20 shadow-pragma-soft dark:bg-primary/15"
          : "text-pragma-mid-gray hover:bg-white/80 hover:text-pragma-black dark:text-muted-foreground dark:hover:bg-sidebar-accent dark:hover:text-foreground",
      )}
    >
      <NavIcon
        name={module.icon}
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
          isStrongActive
            ? "text-pragma-electric"
            : "text-pragma-mid-gray group-hover:text-pragma-electric",
        )}
      />
      {!collapsed ? <span className="min-w-0 flex-1 truncate text-left">{title}</span> : null}
    </button>
  );
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();

  if (collapsed) {
    return (
      <PragmaLogo
        variant="mark"
        symbolClassName="h-12 w-12"
      />
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-2 text-center">
      <PragmaLogo
        variant="full"
        fullClassName="h-16 w-full max-w-full"
        priority
      />
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-pragma-mid-gray dark:text-muted-foreground">
        {t("nav.hostCommandCenter")}
      </p>
    </div>
  );
}

export function Sidebar({
  modules,
  settingsItem,
  user,
  className,
  forceExpanded = false,
  openModuleId = null,
  isModuleStrongActive,
  onGroupClick,
  onMainLinkNavigate,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const { collapsed: storedCollapsed, toggle } = useSidebarCollapsed();
  const collapsed = forceExpanded ? false : storedCollapsed;
  const { t } = useI18n();

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-pragma-soft transition-[width] duration-150 ease-out dark:shadow-none",
        collapsed ? "w-[72px]" : "w-[248px]",
        className,
      )}
    >
      <div
        className={cn(
          "relative shrink-0 border-b border-sidebar-border/80",
          collapsed
            ? "flex h-[4.25rem] items-center justify-center px-2"
            : "px-3 pb-3 pt-4",
        )}
      >
        <BrandMark collapsed={collapsed} />

        {!collapsed && !forceExpanded ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Contraer barra lateral"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-pragma-mid-gray transition-colors hover:bg-pragma-soft-gray hover:text-pragma-black"
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {collapsed && !forceExpanded ? (
        <div className="flex justify-center px-2 pb-2 pt-2">
          <button
            type="button"
            onClick={toggle}
            aria-label="Expandir barra lateral"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-pragma-mid-gray transition-colors hover:bg-pragma-soft-gray"
          >
            <ChevronsRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <nav
        className={cn(
          "pragma-scrollbar flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-3",
          collapsed ? "px-2" : "px-3",
        )}
        aria-label="Navegación principal"
      >
        {modules.map((module) => {
          if (isNavGroupModule(module)) {
            if (!onGroupClick) return null;
            const strongActive = isModuleStrongActive
              ? isModuleStrongActive(module)
              : openModuleId === module.id ||
                isNavModuleActive(pathname, module);
            return (
              <SidebarNavGroupButton
                key={module.id}
                module={module}
                collapsed={collapsed}
                title={t(module.labelKey)}
                isStrongActive={strongActive}
                onGroupClick={onGroupClick}
              />
            );
          }

          const strongActive = isModuleStrongActive
            ? isModuleStrongActive(module)
            : isNavModuleActive(pathname, module);

          return (
            <SidebarNavLink
              key={`${module.href}-${module.labelKey}`}
              item={module}
              collapsed={collapsed}
              title={t(module.labelKey)}
              isActive={strongActive}
              onNavigate={onMainLinkNavigate ?? onNavigate}
            />
          );
        })}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-3 border-t border-sidebar-border py-3",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {settingsItem ? (
          <SidebarNavLink
            item={settingsItem}
            collapsed={collapsed}
            title={t(settingsItem.labelKey)}
            isActive={isNavModuleActive(pathname, { type: "link", ...settingsItem })}
            onNavigate={onNavigate}
          />
        ) : null}

        <SidebarUserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
