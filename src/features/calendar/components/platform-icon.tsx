"use client";

import type { BookingPlatform } from "@prisma/client";
import { cn } from "@/lib/utils";

type PlatformIconProps = {
  platform: BookingPlatform;
  className?: string;
};

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  if (platform === "AIRBNB") {
    return (
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF5A5F] text-[9px] font-bold text-white",
          className,
        )}
        aria-label="Airbnb"
        title="Airbnb"
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
        aria-label="Booking.com"
        title="Booking.com"
      >
        B
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-[#0E9F8D] text-[9px] font-bold text-white ring-1 ring-[#0E9F8D]/30",
        className,
      )}
      aria-label="PRAGMA Direct"
      title="PRAGMA Direct"
    >
      P
    </span>
  );
}
