"use client";

import Image from "next/image";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { CreditCard, LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUserDisplayName,
  getUserInitials,
} from "@/lib/helpers/user-display";
import { cn } from "@/lib/utils";
import type { SidebarUser } from "@/components/layout/sidebar-user-profile";

type SidebarUserMenuProps = {
  user: SidebarUser;
  collapsed: boolean;
};

export function SidebarUserMenu({ user, collapsed }: SidebarUserMenuProps) {
  const { signOut } = useClerk();
  const initials = getUserInitials(user.firstName, user.lastName, user.email);
  const displayName = getUserDisplayName(
    user.firstName,
    user.lastName,
    user.email,
  );
  const isAdmin = user.role === "ADMIN";

  async function handleLogout() {
    await signOut({ redirectUrl: "/sign-in?session_reset=1" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-[#E9ECEF] bg-white p-2.5 text-left transition-colors hover:bg-pragma-light-blue/40 dark:border-sidebar-border dark:bg-sidebar-accent/50 dark:hover:bg-sidebar-accent",
            collapsed && "justify-center border-0 bg-transparent p-0 hover:bg-pragma-light-blue/30",
          )}
          aria-label="Menú de usuario"
        >
          <div className="relative shrink-0">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pragma-soft-cyan text-sm font-semibold text-pragma-electric">
                {initials}
              </div>
            )}
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-pragma-cyan" />
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-[#111111] dark:text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs leading-tight text-[#6B7280]">
                {user.email}
              </p>
            </div>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "center" : "start"}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/settings?tab=profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/billing" className="cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                Facturación
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => void handleLogout()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
