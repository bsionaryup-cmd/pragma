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
import { cn } from "@/lib/utils";

type SidebarProps = {
  items: NavItem[];
  settingsItem: NavItem | null;
  user: SidebarUser;
};

function isNavActive(pathname: string, href: string) {
  if (href === "/panel") {
    return pathname === "/panel";
  }
  return pathname.startsWith(href);
}

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
        "group flex items-center rounded-xl text-[15px] font-medium transition-colors",
        collapsed
          ? "mx-auto h-10 w-10 justify-center"
          : "gap-3 px-3 py-2.5",
        isActive
          ? "border border-[#1a1a1a] bg-[#edf894] text-[#1a1a1a]"
          : "border border-transparent text-[#4a4a4a] hover:bg-[#efefef] hover:text-[#1a1a1a]",
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-[18px] w-[18px]")}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.badge ? (
            <span className="shrink-0 rounded-md bg-[#3b82f6] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
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

  const widthClass = collapsed ? "w-[72px]" : "w-[240px]";

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[#e8e8e8] bg-[#f7f7f7] transition-[width] duration-200 ease-in-out",
        ready ? widthClass : "w-[240px]",
      )}
    >
      {/* Cabecera: logo + toggle */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {collapsed ? (
          <span className="text-xl font-bold tracking-tight text-[#1a1a1a]">
            {APP_NAME.charAt(0)}
          </span>
        ) : (
          <p className="text-[1.35rem] font-bold tracking-tight text-[#1a1a1a]">
            {APP_NAME}
          </p>
        )}

        {!collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Contraer barra lateral"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6b6b6b] transition-colors hover:bg-[#efefef] hover:text-[#1a1a1a]"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6b6b6b] transition-colors hover:bg-[#efefef] hover:text-[#1a1a1a]"
          >
            <ChevronsRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {/* Módulos principales */}
      <nav
        className={cn(
          "flex-1 space-y-0.5 overflow-y-auto",
          collapsed ? "px-2 pt-1" : "px-3 pt-1",
        )}
      >
        {items.map((item) => (
          <SidebarNavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={isNavActive(pathname, item.href)}
          />
        ))}
      </nav>

      {/* Pie: Ajustes + usuario */}
      <div
        className={cn(
          "shrink-0 space-y-3 border-t border-[#e8e8e8] py-4",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {settingsItem ? (
          <SidebarNavLink
            item={settingsItem}
            collapsed={collapsed}
            isActive={isNavActive(pathname, settingsItem.href)}
          />
        ) : null}

        <SidebarUserProfile user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
