import { PropertyUnitBadge } from "@/components/properties/property-unit-badge";
import { formatPropertyLabel, formatPropertyUnit } from "@/lib/property-display";
import { cn } from "@/lib/utils";

type ReservationPropertyLabelProps = {
  property: {
    name: string;
    unitNumber?: string | null;
  };
  className?: string;
  badgeSize?: "sm" | "md" | "lg";
  showBadge?: boolean;
};

export function ReservationPropertyLabel({
  property,
  className,
  badgeSize = "sm",
  showBadge = true,
}: ReservationPropertyLabelProps) {
  const unit = formatPropertyUnit(property.unitNumber);
  const label = showBadge ? formatPropertyLabel(property) : property.name;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {showBadge && unit ? (
        <PropertyUnitBadge unitNumber={unit} size={badgeSize} />
      ) : null}
      <span className="truncate font-semibold text-foreground">{label}</span>
    </span>
  );
}
