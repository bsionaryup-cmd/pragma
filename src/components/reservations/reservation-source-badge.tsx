"use client";

import type { BookingPlatform } from "@prisma/client";
import { PlatformIcon } from "@/features/calendar/components/platform-icon";
import { platformLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ReservationSourceBadgeProps = {
  platform: BookingPlatform;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export function ReservationSourceBadge({
  platform,
  className,
  showLabel = true,
  size = "sm",
}: ReservationSourceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5",
        size === "md" && "px-2 py-1 text-xs",
        size === "sm" && "text-[10px]",
        className,
      )}
      title={platformLabels[platform]}
    >
      <PlatformIcon
        platform={platform}
        className={size === "md" ? "h-5 w-5" : undefined}
      />
      {showLabel ? (
        <span className="truncate font-medium text-foreground/90">
          {platformLabels[platform]}
        </span>
      ) : null}
    </span>
  );
}
