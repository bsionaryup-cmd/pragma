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
      className="flex items-center gap-3 border-b border-[#E9ECEF] px-4 transition-colors hover:bg-[#F7F8FA] dark:border-border dark:hover:bg-muted/20"
      style={rowStyle}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F0F2F5] ring-1 ring-[#E9ECEF]">
        {property.coverImageUrl ? (
          <Image
            src={property.coverImageUrl}
            alt={property.name}
            fill
            className="object-cover"
            sizes="40px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-4 w-4 text-[#9CA3AF]" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-[#111111] dark:text-foreground">
          {property.name}
        </p>
        <p className="truncate text-xs text-[#6B7280] dark:text-muted-foreground">
          {property.city}
        </p>
        {property.pricing?.recommendedRate ? (
          <p className="truncate text-[10px] font-medium text-[#0E9F8D]">
            PL $
            {Number.parseFloat(property.pricing.recommendedRate).toLocaleString(
              "es-CO",
            )}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-1">
        <span
          className={cn(
            "h-2 w-2 rounded-full ring-2 ring-white",
            property.status === "ACTIVE"
              ? "bg-[#0E9F8D]"
              : property.status === "MAINTENANCE"
                ? "bg-[#F5A524]"
                : "bg-[#9CA3AF]",
          )}
        />
        <span className="text-[9px] leading-none text-[#9CA3AF]">
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
      className="flex shrink-0 flex-col border-r border-[#E9ECEF] bg-white dark:border-border dark:bg-card"
      style={{ width: CALENDAR_SIDEBAR_WIDTH }}
    >
      <div
        className="flex shrink-0 flex-col justify-center border-b border-[#E9ECEF] px-3 dark:border-border"
        style={{
          height: CALENDAR_DAY_HEADER_HEIGHT,
          minHeight: CALENDAR_DAY_HEADER_HEIGHT,
          boxSizing: "border-box",
        }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar propiedad..."
            className="h-9 w-full rounded-xl border border-[#E9ECEF] bg-white pl-9 pr-3 text-xs text-[#111111] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#0E9F8D] focus:ring-2 focus:ring-[#0E9F8D]/20 dark:border-input dark:bg-background dark:text-foreground"
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        {properties.length === 0 ? (
          <p className="p-6 text-center text-xs text-[#6B7280]">
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
