import type { BookingPlatform } from "@prisma/client";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { platformLabels } from "@/lib/labels";

export type SourceIconSize = "xs" | "sm" | "md" | "lg";

export const SOURCE_ICON_CONTAINER_CLASS: Record<SourceIconSize, string> = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-7 w-7",
};

export const SOURCE_ICON_IMAGE_SIZES: Record<SourceIconSize, string> = {
  xs: "16px",
  sm: "20px",
  md: "24px",
  lg: "28px",
};

export const SOURCE_ICON_FALLBACK_TEXT_CLASS: Record<SourceIconSize, string> = {
  xs: "text-[7px]",
  sm: "text-[8px]",
  md: "text-[9px]",
  lg: "text-[10px]",
};

export type ReservationSourceBrand = {
  label: string;
  ariaLabel: string;
  imageSrc?: string;
  imagePaddingClass?: string;
  imageClassName?: string;
  containerClassName?: string;
  fallbackClassName?: string;
  fallbackContent?: string;
};

export const RESERVATION_SOURCE_BRANDING: Record<
  BookingPlatform,
  ReservationSourceBrand
> = {
  DIRECT: {
    label: platformLabels.DIRECT,
    ariaLabel: "Reserva directa PRAGMA",
    imageSrc: BRAND_ASSETS.logoPMark,
    imagePaddingClass: "p-0.5",
    imageClassName:
      "origin-center scale-[1.06] saturate-[1.35] contrast-[1.12] object-center",
    containerClassName:
      "bg-[#DDF5EF] ring-1 ring-[#0E9F8D]/45 shadow-sm shadow-[#0E9F8D]/10",
  },
  AIRBNB: {
    label: platformLabels.AIRBNB,
    ariaLabel: "Reserva Airbnb",
    imageSrc: BRAND_ASSETS.airbnbMark,
    imagePaddingClass: "p-0.5",
    imageClassName:
      "origin-center scale-[1.06] saturate-[1.4] contrast-[1.1] object-center",
    containerClassName:
      "bg-[#FFE8E9] ring-1 ring-[#FF5A5F]/40 shadow-sm shadow-[#FF5A5F]/10",
  },
  BOOKING: {
    label: platformLabels.BOOKING,
    ariaLabel: "Reserva Booking.com",
    fallbackClassName:
      "rounded-sm bg-[#003580] font-bold leading-none text-white",
    fallbackContent: "B",
  },
};
