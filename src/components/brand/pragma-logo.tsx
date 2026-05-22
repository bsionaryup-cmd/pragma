import Image from "next/image";
import { BRAND_ASSETS, type BrandLogoVariant } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type PragmaLogoProps = {
  variant?: BrandLogoVariant;
  /** Prefer light-background logo on light surfaces. */
  tone?: "light" | "dark";
  className?: string;
  symbolClassName?: string;
  fullClassName?: string;
  priority?: boolean;
};

const VARIANT_CONFIG: Record<
  BrandLogoVariant,
  { src: string; width: number; height: number }
> = {
  full: { src: BRAND_ASSETS.logoFull, width: 1331, height: 332 },
  fullLight: { src: BRAND_ASSETS.logoFullLight, width: 1331, height: 332 },
  fullDark: { src: BRAND_ASSETS.logoFullDark, width: 1331, height: 332 },
  stacked: { src: BRAND_ASSETS.logoStacked, width: 1331, height: 332 },
  mark: { src: BRAND_ASSETS.logoMark, width: 493, height: 574 },
};

function resolveVariant(
  variant: BrandLogoVariant,
  tone: "light" | "dark",
): BrandLogoVariant {
  if (variant === "full" && tone === "light") return "fullLight";
  if (variant === "full" && tone === "dark") return "fullDark";
  return variant;
}

export function PragmaLogo({
  variant = "full",
  tone = "light",
  className,
  symbolClassName,
  fullClassName,
  priority = false,
}: PragmaLogoProps) {
  const resolved = resolveVariant(variant, tone);
  const { src, width, height } = VARIANT_CONFIG[resolved];
  const isMark = resolved === "mark";

  return (
    <Image
      src={src}
      alt="PRAGMA"
      width={width}
      height={height}
      priority={priority}
      className={cn(
        "mx-auto h-auto w-auto max-w-full shrink-0 object-contain object-center",
        isMark ? symbolClassName : fullClassName,
        className,
      )}
    />
  );
}
