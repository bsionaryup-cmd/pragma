"use client";

import { Bath, BedDouble, CalendarDays, MapPin, Users } from "lucide-react";
import { PropertyCover } from "@/features/properties/components/property-cover";
import {
  getPropertyStatusBadgeClass,
  occupancyBarClass,
} from "@/features/properties/lib/property-style";
import type { PropertyGridItem } from "@/features/properties/types/property.types";
import { propertyStatusLabels, propertyTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type PropertyCardProps = {
  property: PropertyGridItem;
  isSelected?: boolean;
  onSelect: () => void;
};

export function PropertyCard({
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
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-border/80 hover:shadow-md",
        isSelected && "ring-2 ring-foreground/20",
      )}
    >
      <PropertyCover
        id={property.id}
        name={property.name}
        coverImageUrl={property.coverImageUrl}
        className="aspect-[16/10] w-full"
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {property.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location || property.city}</span>
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              getPropertyStatusBadgeClass(property.status),
            )}
          >
            {propertyStatusLabels[property.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {property.maxGuests}
          </span>
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {property.bedrooms} hab · {property.beds} camas
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {property.bathrooms}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {propertyTypeLabels[property.propertyType]}
        </p>

        <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Ocupación mes</span>
            <span className="font-medium">{property.monthOccupancyPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={occupancyBarClass(property.monthOccupancyPercent)}
              style={{ width: `${property.monthOccupancyPercent}%` }}
            />
          </div>

          {property.nextReservation ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">
                  {property.nextReservation.guestName}
                </span>
                {" · "}
                {property.nextReservation.checkIn} →{" "}
                {property.nextReservation.checkOut}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Sin reservas próximas</p>
          )}

          {property.upcomingCount > 1 ? (
            <p className="text-[11px] text-muted-foreground">
              +{property.upcomingCount - 1} reserva
              {property.upcomingCount - 1 === 1 ? "" : "s"} más
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
