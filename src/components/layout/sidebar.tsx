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
import type { NavItem } from "@/lib/navigation";
import { isNavPathActive } from "@/lib/navigation-active";
import { cn } from "@/lib/utils";

type SidebarProps = {
  items: NavItem[];
  settingsItem: NavItem | null;
  user: SidebarUser;
  className?: string;
  forceExpanded?: boolean;
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
      prefetch={true}
      title={collapsed ? title : undefined}
      onClick={() => onNavigate?.()}
      className={cn(
        "group flex items-center rounded-xl text-[14px] font-medium transition-all duration-200",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "gap-3 px-3 py-2",
        isActive
          ? "bg-pragma-soft-cyan text-pragma-electric ring-1 ring-pragma-cyan/25 shadow-pragma-soft dark:bg-primary/15"
          : "text-pragma-mid-gray hover:bg-pragma-light-blue/60 hover:text-pragma-black dark:text-muted-foreground dark:hover:bg-sidebar-accent dark:hover:text-foreground",
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
  items,
  settingsItem,
  user,
  className,
  forceExpanded = false,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const { collapsed: storedCollapsed, toggle, ready } = useSidebarCollapsed();
  const collapsed = forceExpanded ? false : storedCollapsed;
  const { t } = useI18n();

  const widthClass = collapsed ? "w-[72px]" : "w-[248px]";

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-pragma-soft transition-[width] duration-200 ease-in-out dark:shadow-none",
        ready ? widthClass : "w-[248px]",
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
        {items.map((item) => (
          <SidebarNavLink
            key={`${item.href}-${item.labelKey}`}
            item={item}
            collapsed={collapsed}
            title={t(item.labelKey)}
            isActive={isNavPathActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
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
            isActive={isNavPathActive(pathname, settingsItem.href)}
            onNavigate={onNavigate}
          />
        ) : null}

        <SidebarUserMenu user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
