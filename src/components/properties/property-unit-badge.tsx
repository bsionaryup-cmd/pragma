import { cn } from "@/lib/utils";
import { formatPropertyUnit } from "@/lib/property-display";

type PropertyUnitBadgeProps = {
  unitNumber?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "min-w-[2rem] px-1.5 py-0.5 text-[10px]",
  md: "min-w-[2.5rem] px-2 py-0.5 text-xs",
  lg: "min-w-[3rem] px-2.5 py-1 text-sm",
};

export function PropertyUnitBadge({
  unitNumber,
  className,
  size = "md",
}: PropertyUnitBadgeProps) {
  const unit = formatPropertyUnit(unitNumber);
  if (!unit) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 font-bold tabular-nums tracking-tight text-primary",
        sizeClasses[size],
        className,
      )}
    >
      {unit}
    </span>
  );
}
