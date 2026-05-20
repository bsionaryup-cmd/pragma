"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { NavIcon } from "@/components/layout/nav-icon";
import {
  SidebarUserProfile,
  type SidebarUser,
} from "@/components/layout/sidebar-user-profile";
import { useSidebarCollapsed } from "@/components/layout/use-sidebar-collapsed";
import type { NavItem } from "@/lib/navigation";
import { isNavPathActive } from "@/lib/navigation-active";
import { cn } from "@/lib/utils";

type SidebarProps = {
  items: NavItem[];
  settingsItem: NavItem | null;
  user: SidebarUser;
};

function SidebarNavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.title : undefined}
      className={cn(
        "group flex items-center rounded-xl text-[15px] font-medium transition-all duration-200",
        collapsed
          ? "mx-auto h-11 w-11 justify-center"
          : "gap-3 px-3.5 py-2.5",
        isActive
          ? "bg-[#E6F7F5] text-[#0B7A6E] shadow-pragma-soft dark:bg-primary/15 dark:text-primary"
          : "text-[#6B7280] hover:bg-[#E6F7F5]/70 hover:text-[#111111] dark:text-muted-foreground dark:hover:bg-sidebar-accent dark:hover:text-foreground",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          isActive ? "text-[#0E9F8D]" : "text-[#9CA3AF] group-hover:text-[#0E9F8D]",
        )}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.badge ? (
            <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

export function Sidebar({ items, settingsItem, user }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle, ready } = useSidebarCollapsed();

  const widthClass = collapsed ? "w-[72px]" : "w-[260px]";

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[#E9ECEF] bg-white shadow-pragma-soft transition-[width] duration-200 ease-in-out dark:border-sidebar-border dark:bg-sidebar dark:shadow-none",
        ready ? widthClass : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "flex h-[4.25rem] shrink-0 items-center",
          collapsed ? "justify-center px-2" : "justify-between px-5",
        )}
      >
        {collapsed ? (
          <span className="text-xl font-bold tracking-tight text-[#0E9F8D]">
            {APP_NAME.charAt(0)}
          </span>
        ) : (
          <p className="text-xl font-bold tracking-tight text-[#111111] dark:text-foreground">
            {APP_NAME}
          </p>
        )}

        {!collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Contraer barra lateral"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#F7F8FA] hover:text-[#111111]"
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        <div className="flex justify-center px-2 pb-2">
          <button
            type="button"
            onClick={toggle}
            aria-label="Expandir barra lateral"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#F7F8FA] hover:text-[#111111]"
          >
            <ChevronsRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <nav
        className={cn(
          "flex-1 space-y-1 overflow-y-auto",
          collapsed ? "px-2 pt-1" : "px-4 pt-2",
        )}
      >
        {items.map((item) => (
          <SidebarNavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={isNavPathActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-2 border-t border-[#E9ECEF] py-4 dark:border-sidebar-border",
          collapsed ? "px-2" : "px-4",
        )}
      >
        {settingsItem ? (
          <SidebarNavLink
            item={settingsItem}
            collapsed={collapsed}
            isActive={isNavPathActive(pathname, settingsItem.href)}
          />
        ) : null}

        <SidebarUserProfile user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
