import Image from "next/image";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type PragmaAuthBrandProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

/** Lockup horizontal para fondos oscuros: isotipo + PRAGMA en blanco. */
export function PragmaAuthBrand({
  className,
  markClassName,
  wordmarkClassName,
}: PragmaAuthBrandProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3.5 sm:gap-4",
        className,
      )}
      aria-label="PRAGMA"
    >
      <Image
        src={BRAND_ASSETS.logoMark}
        alt=""
        width={493}
        height={574}
        priority
        aria-hidden
        className={cn(
          "h-[4.25rem] w-auto shrink-0 object-contain object-center sm:h-[4.75rem] md:h-20",
          markClassName,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "font-heading text-[2.5rem] font-bold uppercase leading-none tracking-[0.14em] text-white sm:text-[2.75rem] md:text-5xl",
          wordmarkClassName,
        )}
      >
        PRAGMA
      </span>
    </div>
  );
}
