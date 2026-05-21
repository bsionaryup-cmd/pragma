import { BRAND_ASSETS } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type PragmaLoaderProps = {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function PragmaLoader({
  className,
  label = "Cargando",
  size = "md",
}: PragmaLoaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_ASSETS.loader}
        alt=""
        className={cn(sizeMap[size], "object-contain motion-safe:animate-pulse")}
        aria-hidden
      />
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}
