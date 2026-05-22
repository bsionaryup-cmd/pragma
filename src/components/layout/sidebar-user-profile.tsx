"use client";

import Image from "next/image";
import {
  getUserDisplayName,
  getUserInitials,
} from "@/lib/helpers/user-display";
import { cn } from "@/lib/utils";

export type SidebarUser = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  role?: "ADMIN" | "RECEPTIONIST";
};

type SidebarUserProfileProps = {
  user: SidebarUser;
  collapsed: boolean;
};

export function SidebarUserProfile({ user, collapsed }: SidebarUserProfileProps) {
  const initials = getUserInitials(user.firstName, user.lastName, user.email);
  const displayName = getUserDisplayName(
    user.firstName,
    user.lastName,
    user.email,
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-[#E9ECEF] bg-white p-2.5 transition-colors dark:border-sidebar-border dark:bg-sidebar-accent/50",
        collapsed && "justify-center border-0 bg-transparent p-0",
      )}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F7F5] text-sm font-semibold text-[#0E9F8D]">
            {initials}
          </div>
        )}
        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#14B8A6]" />
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
    </div>
  );
}
