"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import {
  OwnerAccountMenu,
  type OwnerAccountMenuUser,
} from "@/components/owner/owner-account-menu";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants.client";
import { cn } from "@/lib/utils";

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
