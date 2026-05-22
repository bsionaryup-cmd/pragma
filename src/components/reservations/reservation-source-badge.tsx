"use client";

import type { BookingPlatform } from "@prisma/client";
import { ReservationSourceIcon } from "@/components/reservations/reservation-source-icon";
import { RESERVATION_SOURCE_BRANDING } from "@/lib/reservation-source-branding";
import { cn } from "@/lib/utils";

type ReservationSourceBadgeProps = {
  platform: BookingPlatform;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const BADGE_ICON_SIZE = {
  sm: "sm",
  md: "md",
} as const satisfies Record<
  NonNullable<ReservationSourceBadgeProps["size"]>,
  "sm" | "md"
>;

export function ReservationSourceBadge({
  platform,
  className,
  showLabel = true,
  size = "sm",
}: ReservationSourceBadgeProps) {
  const brand = RESERVATION_SOURCE_BRANDING[platform];

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-background/95 shadow-sm",
        size === "md" ? "px-2 py-1" : "px-1.5 py-0.5",
        className,
      )}
      title={brand.label}
      aria-label={brand.ariaLabel}
    >
      <ReservationSourceIcon
        platform={platform}
        size={BADGE_ICON_SIZE[size]}
        framed={false}
      />
      {showLabel ? (
        <span
          className={cn(
            "truncate font-medium text-muted-foreground",
            size === "md" ? "text-xs" : "text-[10px]",
          )}
        >
          {brand.label}
        </span>
      ) : null}
    </span>
  );
}
