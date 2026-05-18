"use client";

import { User } from "lucide-react";
import type { BookingPlatform } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getPlatformAccent } from "@/features/calendar/lib/reservation-style";

type PlatformIconProps = {
  platform: BookingPlatform;
  className?: string;
};

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  if (platform === "AIRBNB") {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ff5a5f] text-[9px] font-bold text-white",
          className,
        )}
        aria-hidden
      >
        A
      </span>
    );
  }

  if (platform === "BOOKING") {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#003580] text-[8px] font-bold text-white",
          className,
        )}
        aria-hidden
      >
        B
      </span>
    );
  }

  return (
    <User
      className={cn("h-3.5 w-3.5 shrink-0", getPlatformAccent(platform), className)}
      aria-hidden
    />
  );
}
