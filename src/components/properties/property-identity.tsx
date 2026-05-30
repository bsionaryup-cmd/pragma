import { PropertyUnitBadge } from "@/components/properties/property-unit-badge";
import {
  formatPropertyLabel,
  formatPropertyUnit,
  formatPropertyUnitDisplay,
  resolvePropertyUnit,
} from "@/lib/property-display";
import { cn } from "@/lib/utils";

type PropertyIdentityProps = {
  name: string;
  unitNumber?: string | null;
  listingName?: string | null;
  className?: string;
  /** inline: badge + name on one row; stack: unit prominent above secondary name */
  layout?: "inline" | "stack";
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  showBadge?: boolean;
  nameClassName?: string;
  unitClassName?: string;
};

function resolveUnit(
  name: string,
  unitNumber?: string | null,
  listingName?: string | null,
): string | null {
  const fromField = formatPropertyUnit(unitNumber);
  if (fromField) return formatPropertyUnitDisplay(fromField);

  const fromLabel = resolvePropertyUnit({ name, unitNumber, listingName });
  if (!fromLabel) return null;
  const display = formatPropertyUnitDisplay(fromLabel);
  return display === "—" ? null : display;
}

export function PropertyIdentity({
  name,
  unitNumber,
  listingName,
  className,
  layout = "stack",
  size = "md",
  showName = true,
  showBadge = true,
  nameClassName,
  unitClassName,
}: PropertyIdentityProps) {
  const unit = resolveUnit(name, unitNumber, listingName);

  if (layout === "inline") {
    const label = showBadge ? formatPropertyLabel({ name, unitNumber }) : name;
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
        {showBadge && unit ? (
          <PropertyUnitBadge unitNumber={unit} size={size} />
        ) : null}
        <span
          className={cn(
            "truncate font-semibold text-foreground",
            nameClassName,
          )}
        >
          {label}
        </span>
      </span>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {unit ? (
        <p
          className={cn(
            "truncate font-bold tabular-nums tracking-tight text-foreground",
            size === "lg"
              ? "text-lg"
              : size === "md"
                ? "text-base"
                : "text-sm",
            unitClassName,
          )}
        >
          {unit}
        </p>
      ) : null}
      {showName ? (
        <p
          className={cn(
            "truncate text-muted-foreground",
            unit ? "mt-0.5 text-xs" : "text-sm font-semibold text-foreground",
            nameClassName,
          )}
        >
          {name}
        </p>
      ) : null}
    </div>
  );
}
