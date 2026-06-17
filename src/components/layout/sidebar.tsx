"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NavIcon } from "@/components/layout/nav-icon";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarUserMenu } from "@/components/layout/sidebar-user-menu";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";
import { useSidebarCollapsed } from "@/components/layout/use-sidebar-collapsed";
import { useI18n } from "@/components/providers/i18n-provider";
import { useNovedadesUnread } from "@/features/novedades/components/novedades-unread-provider";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import {
  isNavGroupModule,
  isNavModuleActive,
  type NavGroupModule,
  type NavItem,
  type NavModule,
} from "@/lib/navigation";
import {
  MAIN_SIDEBAR_WIDTH_CLASS,
} from "@/components/layout/nav-layout.constants";
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
  showUnreadDot = false,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  title: string;
  onNavigate?: () => void;
  showUnreadDot?: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? title : undefined}
      onClick={() => onNavigate?.()}
      className={cn(
        "group relative flex items-center rounded-xl text-[14px] font-medium transition-colors duration-150",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "gap-3 px-3 py-2",
        isActive
          ? "bg-pragma-soft-cyan text-pragma-electric ring-1 ring-pragma-cyan/20 shadow-pragma-soft"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn(
          "relative shrink-0 transition-colors",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
          isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-primary",
        )}
      />
      {collapsed && showUnreadDot ? (
        <span
          className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500 ring-2 ring-sidebar"
          aria-hidden
        />
      ) : null}
      {!collapsed ? (
        <>
          <span className="relative min-w-0 flex-1 truncate">
            {title}
            {showUnreadDot ? (
              <span
                className="absolute -right-1 top-0 h-2 w-2 translate-x-full rounded-full bg-red-500"
                aria-hidden
              />
            ) : null}
          </span>
          {item.badge ? (
            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
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
          ? "bg-pragma-soft-cyan text-pragma-electric ring-1 ring-pragma-cyan/20 shadow-pragma-soft"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <NavIcon
        name={module.icon}
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
          isStrongActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-primary",
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
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
  const { hasUnread: hasNovedadesUnread } = useNovedadesUnread();

  return (
    <aside
      className={cn(
        "flex min-h-0 shrink-0 flex-col self-stretch border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-pragma-soft transition-[width] duration-150 ease-out dark:shadow-none",
        collapsed ? "w-[72px]" : MAIN_SIDEBAR_WIDTH_CLASS,
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
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ChevronsRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <nav
        className={cn(
          "pragma-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-3",
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
              showUnreadDot={module.href === "/novedades" && hasNovedadesUnread}
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

        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-start px-1",
          )}
        >
          <ThemeToggle size="sm" align={collapsed ? "start" : "end"} />
        </div>

        <SidebarUserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
