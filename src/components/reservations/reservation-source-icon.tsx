"use client";

import type { BookingPlatform } from "@prisma/client";
import Image from "next/image";
import {
  RESERVATION_SOURCE_BRANDING,
  SOURCE_ICON_CONTAINER_CLASS,
  SOURCE_ICON_FALLBACK_TEXT_CLASS,
  SOURCE_ICON_IMAGE_SIZES,
  type SourceIconSize,
} from "@/lib/reservation-source-branding";
import { cn } from "@/lib/utils";

export type ReservationSourceIconProps = {
  platform: BookingPlatform;
  size?: SourceIconSize;
  /** When false, omits outer frame — use inside ReservationSourceBadge. */
  framed?: boolean;
  className?: string;
};

export function ReservationSourceIcon({
  platform,
  size = "sm",
  framed = true,
  className,
}: ReservationSourceIconProps) {
  const brand = RESERVATION_SOURCE_BRANDING[platform];
  const tooltipProps = framed
    ? { "aria-label": brand.ariaLabel, title: brand.label }
    : { "aria-hidden": true as const };

  if (brand.imageSrc) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
          SOURCE_ICON_CONTAINER_CLASS[size],
          framed && brand.containerClassName,
          framed && !brand.containerClassName && "bg-background ring-1 ring-border/60",
          className,
        )}
        {...tooltipProps}
      >
        <Image
          src={brand.imageSrc}
          alt=""
          fill
          sizes={SOURCE_ICON_IMAGE_SIZES[size]}
          className={cn(
            "object-contain object-center",
            brand.imagePaddingClass,
            brand.imageClassName,
          )}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SOURCE_ICON_CONTAINER_CLASS[size],
        brand.fallbackClassName,
        SOURCE_ICON_FALLBACK_TEXT_CLASS[size],
        className,
      )}
      {...tooltipProps}
    >
      {brand.fallbackContent}
    </span>
  );
}
