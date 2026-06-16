"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

/** Responsive `sizes` for hero column (~50vw desktop). */
export const LANDING_PRODUCT_SCREENSHOT_DEFAULT_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 640px";

/** Responsive `sizes` for full-width showcase container. */
export const LANDING_SHOWCASE_SCREENSHOT_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 94vw, 1200px";

/** Approved marketing assets — synthetic demo tenant only. */
export const LANDING_MARKETING_SCREENSHOTS = {
  hero: {
    src: "/marketing/screenshots/panel-command-center-main.webp",
    width: 2236,
    height: 1120,
    alt: "Panel de control PRAGMA con próximas llegadas y actividad diaria",
  },
  showcase: {
    src: "/marketing/screenshots/calendar-june-mid-main.webp",
    width: 2620,
    height: 1516,
    alt: "Calendario PRAGMA con reservas por propiedad en junio",
  },
} as const;

export type LandingScreenshotEmphasis = "hero" | "showcase";

export type LandingProductScreenshotProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
  emphasis?: LandingScreenshotEmphasis;
};

const EMPHASIS_STYLES: Record<LandingScreenshotEmphasis, string> = {
  hero: "shadow-[0_28px_80px_-16px_rgba(11,107,255,0.28)] ring-1 ring-black/[0.06]",
  showcase:
    "shadow-[0_32px_96px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10",
};

/**
 * Framed product screenshot for the marketing landing (Linear / Vercel–style).
 */
export function LandingProductScreenshot({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes = LANDING_PRODUCT_SCREENSHOT_DEFAULT_SIZES,
  emphasis,
}: LandingProductScreenshotProps) {
  return (
    <figure
      className={cn(
        "relative m-0 w-full overflow-hidden rounded-2xl border border-pragma-border/90 bg-white",
        emphasis ? EMPHASIS_STYLES[emphasis] : "shadow-pragma-glow ring-1 ring-black/[0.04]",
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
