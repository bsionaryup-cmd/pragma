"use client";

import { memo } from "react";
import { Bath, BedDouble, CalendarDays, MapPin, Users } from "lucide-react";
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl border border-[#E9ECEF] bg-white px-4 py-3.5 text-left shadow-pragma-soft transition-colors duration-150",
        "hover:border-primary/20 hover:bg-muted/30",
        isSelected && "ring-2 ring-primary/20",
      )}
    >
      <PropertyCover
        id={property.id}
        name={property.name}
        coverImageUrl={property.coverImageUrl}
        className="h-[4.5rem] w-[5.5rem] shrink-0 rounded-lg"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <PropertyIdentity
              name={property.name}
              unitNumber={property.unitNumber}
              size="md"
            />
            <p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {location || property.city} · {propertyTypeLabels[property.propertyType]}
              </span>
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

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {property.maxGuests} huéspedes
          </span>
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {property.bedrooms} hab · {property.beds} camas
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {property.bathrooms} baños
          </span>
          <span className="inline-flex items-center gap-1">
            Ocupación: {property.monthOccupancyPercent}%
          </span>
        </div>

        {property.nextReservation ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              <span className="font-medium text-foreground">
                {property.nextReservation.guestName}
              </span>
              {" · "}
              {property.nextReservation.checkIn} → {property.nextReservation.checkOut}
            </span>
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">Sin reservas próximas</p>
        )}

        {property.upcomingCount > 1 ? (
          <p className="mt-1 text-[10px] text-muted-foreground">
            +{property.upcomingCount - 1} reserva
            {property.upcomingCount - 1 === 1 ? "" : "s"} más
          </p>
        ) : null}
      </div>
    </button>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
