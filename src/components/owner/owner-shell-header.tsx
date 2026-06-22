"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import {
  OwnerAccountMenu,
  type OwnerAccountMenuUser,
} from "@/components/owner/owner-account-menu";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants.client";
import { cn } from "@/lib/utils";

const PLATFORM_NAV = [
  { href: OWNER_DASHBOARD_PATH, label: "Resumen", activePrefix: OWNER_DASHBOARD_PATH, exact: true },
  {
    href: "/owner-dashboard/sales/prospects",
    label: "Consola de ventas",
    activePrefix: "/owner-dashboard/sales",
  },
  { href: "/owner-dashboard/support", label: "Soporte", activePrefix: "/owner-dashboard/support" },
] as const;

type OwnerShellHeaderProps = {
  user: OwnerAccountMenuUser;
  hasOwnOrganization: boolean;
  context?: "platform" | "tenant-self";
  className?: string;
};

export function OwnerShellHeader({
  user,
  hasOwnOrganization,
  context = "platform",
  className,
}: OwnerShellHeaderProps) {
  const pathname = usePathname();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={OWNER_DASHBOARD_PATH}
            className="flex shrink-0 items-center gap-2.5"
            aria-label="Owner Dashboard PRAGMA"
          >
            <PragmaLogo variant="mark" symbolClassName="h-9 w-9" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                PRAGMA Owner
              </p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3 shrink-0 text-pragma-electric" />
                {context === "platform"
                  ? "Centro de control de plataforma"
                  : "Configuración de tu cuenta"}
              </p>
            </div>
          </Link>

          {context === "platform" ? (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Owner platform">
              {PLATFORM_NAV.map((item) => {
                const isActive =
                  "exact" in item && item.exact
                    ? pathname === item.activePrefix
                    : pathname.startsWith(item.activePrefix);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-pragma-electric/15 text-pragma-electric"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>

        <OwnerAccountMenu
          user={user}
          hasOwnOrganization={hasOwnOrganization}
          variant="default"
        />
      </div>
    </header>
  );
}
