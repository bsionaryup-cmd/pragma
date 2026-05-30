"use client";

import { memo } from "react";
import { CalendarDays } from "lucide-react";
import { PropertyCover } from "@/features/properties/components/property-cover";
import { getPropertyStatusBadgeClass } from "@/features/properties/lib/property-style";
import type { PropertyGridItem } from "@/features/properties/types/property.types";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { propertyStatusLabels, propertyTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type PropertyCardProps = {
  property: PropertyGridItem;
  isSelected?: boolean;
  onSelect: () => void;
};

function PropertyCardComponent({
  property,
  isSelected,
  onSelect,
}: PropertyCardProps) {
  const location = [property.neighborhood, property.city]
    .filter(Boolean)
    .join(", ");

  const capacity = [
    `${property.maxGuests} huésp.`,
    `${property.bedrooms} hab`,
    `${property.bathrooms} baños`,
  ].join(" · ");

  const nextStay = property.nextReservation
    ? `${property.nextReservation.guestName} · ${property.nextReservation.checkIn} → ${property.nextReservation.checkOut}`
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors",
        "hover:border-pragma-electric/30 hover:bg-muted/30",
        isSelected &&
          "border-pragma-electric bg-pragma-electric/5 ring-1 ring-pragma-electric/20",
      )}
    >
      <PropertyCover
        id={property.id}
        name={property.name}
        coverImageUrl={property.coverImageUrl}
        className="h-14 w-[4.25rem] shrink-0 rounded-md"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <PropertyIdentity
              name={property.name}
              unitNumber={property.unitNumber}
              size="sm"
            />
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {location || property.city || "Sin ubicación"} ·{" "}
              {propertyTypeLabels[property.propertyType]}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
              getPropertyStatusBadgeClass(property.status),
            )}
          >
            {propertyStatusLabels[property.status]}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{capacity}</span>
          <span className="shrink-0 tabular-nums font-medium text-foreground">
            {property.monthOccupancyPercent}% occ.
          </span>
        </div>

        {nextStay ? (
          <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span className="truncate">{nextStay}</span>
            {property.upcomingCount > 1 ? (
              <span className="shrink-0 text-[10px]">
                +{property.upcomingCount - 1}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Sin reservas próximas
          </p>
        )}
      </div>
    </button>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
