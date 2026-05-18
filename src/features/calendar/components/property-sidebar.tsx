"use client";

import { Building2, Search } from "lucide-react";
import Image from "next/image";
import { memo } from "react";
import {
  CALENDAR_DAY_HEADER_HEIGHT,
  CALENDAR_ROW_HEIGHT,
  CALENDAR_SIDEBAR_WIDTH,
} from "@/features/calendar/constants";
import type { CalendarPropertyDto } from "@/features/calendar/types/calendar.types";
import { propertyTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const rowStyle: React.CSSProperties = {
  height: CALENDAR_ROW_HEIGHT,
  minHeight: CALENDAR_ROW_HEIGHT,
  maxHeight: CALENDAR_ROW_HEIGHT,
  boxSizing: "border-box",
};

type PropertySidebarProps = {
  properties: CalendarPropertyDto[];
  search: string;
  onSearchChange: (value: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
};

function PropertySidebarItem({ property }: { property: CalendarPropertyDto }) {
  return (
    <div
      className="flex items-center gap-2.5 border-b border-border px-3"
      style={rowStyle}
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted">
        {property.coverImageUrl ? (
          <Image
            src={property.coverImageUrl}
            alt={property.name}
            fill
            className="object-cover"
            sizes="36px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight">
          {property.name}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {property.city}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            property.status === "ACTIVE"
              ? "bg-emerald-500"
              : property.status === "MAINTENANCE"
                ? "bg-amber-500"
                : "bg-muted-foreground",
          )}
        />
        <span className="text-[9px] leading-none text-muted-foreground">
          {propertyTypeLabels[property.propertyType]}
        </span>
      </div>
    </div>
  );
}

const PropertySidebarItemMemo = memo(PropertySidebarItem);

function PropertySidebarComponent({
  properties,
  search,
  onSearchChange,
  scrollRef,
  onScroll,
}: PropertySidebarProps) {
  return (
    <aside
      className="flex shrink-0 flex-col border-r border-border bg-background"
      style={{ width: CALENDAR_SIDEBAR_WIDTH }}
    >
      <div
        className="flex shrink-0 flex-col justify-center border-b border-border px-2.5"
        style={{
          height: CALENDAR_DAY_HEADER_HEIGHT,
          minHeight: CALENDAR_DAY_HEADER_HEIGHT,
          boxSizing: "border-box",
        }}
      >
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        {properties.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Sin propiedades
          </p>
        ) : (
          properties.map((property) => (
            <PropertySidebarItemMemo key={property.id} property={property} />
          ))
        )}
      </div>
    </aside>
  );
}

export const PropertySidebar = memo(PropertySidebarComponent);
