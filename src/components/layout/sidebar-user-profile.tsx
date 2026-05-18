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
        "flex items-center gap-3",
        collapsed ? "justify-center px-0" : "px-1",
      )}
    >
      <div className="relative shrink-0">
        {user.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt={displayName}
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9ca3af] text-xs font-semibold text-white">
            {initials}
          </div>
        )}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f7f7f7] bg-[#3b82f6]" />
      </div>

      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase leading-tight tracking-wide text-[#1a1a1a]">
            {displayName}
          </p>
          <p className="truncate text-[11px] leading-tight text-[#9ca3af]">
            {user.email}
          </p>
        </div>
      ) : null}
    </div>
  );
}
