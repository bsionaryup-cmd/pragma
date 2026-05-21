import Image from "next/image";
import { BRAND_ASSETS, type BrandLogoVariant } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type PragmaLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  symbolClassName?: string;
  fullClassName?: string;
  priority?: boolean;
};

const VARIANT_SRC: Record<BrandLogoVariant, string> = {
  full: BRAND_ASSETS.logoFull,
  fullLight: BRAND_ASSETS.logoFull,
  fullDark: BRAND_ASSETS.logoFull,
  symbol: BRAND_ASSETS.symbol,
  symbolDark: BRAND_ASSETS.symbolDark,
};

const VARIANT_SIZE: Record<BrandLogoVariant, { width: number; height: number }> = {
  full: { width: 220, height: 78 },
  fullLight: { width: 220, height: 78 },
  fullDark: { width: 220, height: 78 },
  symbol: { width: 40, height: 40 },
  symbolDark: { width: 40, height: 40 },
};

export function PragmaLogo({
  variant = "full",
  className,
  symbolClassName,
  fullClassName,
  priority = false,
}: PragmaLogoProps) {
  const src = VARIANT_SRC[variant];
  const size = VARIANT_SIZE[variant];
  const isFull = variant.startsWith("full");

  return (
    <Image
      src={src}
      alt="PRAGMA"
      width={size.width}
      height={size.height}
      priority={priority}
      className={cn(
        "h-auto w-auto object-contain",
        isFull ? fullClassName : symbolClassName,
        className,
      )}
    />
  );
}
