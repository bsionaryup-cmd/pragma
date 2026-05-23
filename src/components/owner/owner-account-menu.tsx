"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getUserDisplayName,
  getUserInitials,
} from "@/lib/helpers/user-display";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants.client";
import { cn } from "@/lib/utils";

export type OwnerAccountMenuUser = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
};

type OwnerAccountMenuProps = {
  user: OwnerAccountMenuUser;
  hasOwnOrganization: boolean;
  variant?: "default" | "compact";
};

export function OwnerAccountMenu({
  user,
  hasOwnOrganization,
  variant = "default",
}: OwnerAccountMenuProps) {
  const { signOut } = useClerk();
  const pathname = usePathname();
  const displayName = getUserDisplayName(
    user.firstName,
    user.lastName,
    user.email,
  );
  const initials = getUserInitials(user.firstName, user.lastName, user.email);
  const onOwnerDashboard = pathname.startsWith(OWNER_DASHBOARD_PATH);

  async function handleLogout() {
    await signOut({ redirectUrl: "/owner-login" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          className={cn(
            "gap-2 border-[#E5E7EB] bg-white pl-2 pr-2.5 shadow-sm hover:bg-pragma-light-blue/30 dark:border-border dark:bg-card",
            variant === "compact" && "h-9",
          )}
          aria-label="Menú de cuenta Owner"
        >
          <span className="relative shrink-0">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={displayName}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pragma-soft-cyan text-xs font-semibold text-pragma-electric">
                {initials}
              </span>
            )}
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-pragma-cyan" />
          </span>
          {variant === "default" ? (
            <span className="hidden min-w-0 max-w-[140px] truncate text-left sm:inline">
              <span className="block truncate text-sm font-semibold leading-tight">
                {displayName}
              </span>
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                Cuenta Owner
              </span>
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-start gap-3">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pragma-soft-cyan text-sm font-semibold text-pragma-electric">
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-pragma-soft-cyan px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pragma-electric">
                <Shield className="h-3 w-3" />
                Super Admin Owner
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mi cuenta
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Configuración de cuenta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Perfil y preferencias
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/owner-dashboard/billing" className="cursor-pointer">
            <CreditCard className="mr-2 h-4 w-4" />
            Infraestructura Wompi
          </Link>
        </DropdownMenuItem>

        {hasOwnOrganization ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Operación tenant
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/integrations" className="cursor-pointer">
                <Plug className="mr-2 h-4 w-4" />
                Integraciones
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/users" className="cursor-pointer">
                <Users className="mr-2 h-4 w-4" />
                Equipo y usuarios
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

        {!onOwnerDashboard ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={OWNER_DASHBOARD_PATH} className="cursor-pointer">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Owner Dashboard
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
