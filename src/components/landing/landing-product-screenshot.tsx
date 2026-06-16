"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

/** Responsive `sizes` for hero column (~50vw desktop). */
export const LANDING_PRODUCT_SCREENSHOT_DEFAULT_SIZES =
  "(max-width: 768px) 100vw, 50vw";

/** Responsive `sizes` for full-width showcase container. */
export const LANDING_SHOWCASE_SCREENSHOT_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1152px";

/** Approved 0F-1b marketing assets — for 0F-3 / 0F-4 integration. */
export const LANDING_MARKETING_SCREENSHOTS = {
  hero: {
    src: "/marketing/screenshots/panel-command-center-main.webp",
    width: 2384,
    height: 1800,
    alt: "Panel de control PRAGMA con próximas llegadas y actividad diaria",
  },
  showcase: {
    src: "/marketing/screenshots/calendar-june-mid-main.webp",
    width: 2704,
    height: 1800,
    alt: "Calendario PRAGMA con reservas por propiedad en junio",
  },
} as const;

export type LandingProductScreenshotProps = {
  src: string;
  alt: string;
  /** Intrinsic width of the WebP asset (retina source). */
  width: number;
  /** Intrinsic height of the WebP asset (retina source). */
  height: number;
  /** LCP hero — eager load + high fetch priority. */
  priority?: boolean;
  className?: string;
  sizes?: string;
};

/**
 * Framed product screenshot for the marketing landing (Linear / Vercel–style).
 * Centralizes next/image, border, shadow, aspect ratio, and loading behavior.
 */
export function LandingProductScreenshot({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes = LANDING_PRODUCT_SCREENSHOT_DEFAULT_SIZES,
}: LandingProductScreenshotProps) {
  return (
    <figure
      className={cn(
        "relative m-0 w-full overflow-hidden rounded-2xl border border-pragma-border/90 bg-white",
        "shadow-pragma-glow ring-1 ring-black/[0.04]",
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="block h-full w-full object-cover object-left-top"
        draggable={false}
      />
    </figure>
  );
}
