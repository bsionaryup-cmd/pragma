import { PropertyIdentity } from "@/components/properties/property-identity";

type ReservationPropertyLabelProps = {
  property: {
    name: string;
    unitNumber?: string | null;
  };
  className?: string;
  badgeSize?: "sm" | "md" | "lg";
  showBadge?: boolean;
  layout?: "inline" | "stack";
};

export function ReservationPropertyLabel({
  property,
  className,
  badgeSize = "sm",
  showBadge = true,
  layout = "stack",
}: ReservationPropertyLabelProps) {
  return (
    <PropertyIdentity
      name={property.name}
      unitNumber={property.unitNumber}
      className={className}
      layout={layout}
      size={badgeSize}
      showBadge={showBadge}
    />
  );
}
