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
      className="flex items-center gap-2.5 border-b-2 border-[var(--cal-border-strong)] px-3 transition-colors hover:bg-[var(--cal-bg-hover)]"
      style={rowStyle}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--cal-bg-thumbnail)] ring-1 ring-[var(--cal-border)]">
        {property.coverImageUrl ? (
          <Image
            src={property.coverImageUrl}
            alt={property.name}
            fill
            className="object-cover"
            sizes="40px"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-4 w-4 text-[var(--cal-text-muted)]" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-[#111111]">
          {property.name}
        </p>
        <p className="truncate text-xs text-[var(--cal-text-secondary)]">
          {property.city}
        </p>
        {property.pricing?.recommendedRate ? (
          <p className="truncate text-[11px] font-medium text-[#0E9F8D]">
            PL $
            {Number.parseFloat(property.pricing.recommendedRate).toLocaleString(
              "es-CO",
            )}
          </p>
        ) : null}
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
      className="flex shrink-0 flex-col border-r border-[var(--cal-border)] bg-white"
      style={{ width: CALENDAR_SIDEBAR_WIDTH }}
    >
      <div
        className="flex shrink-0 flex-col justify-center border-b border-[var(--cal-border)] px-3"
        style={{
          height: CALENDAR_DAY_HEADER_HEIGHT,
          minHeight: CALENDAR_DAY_HEADER_HEIGHT,
          boxSizing: "border-box",
        }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cal-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar propiedad..."
            className="h-9 w-full rounded-xl border border-[var(--cal-border)] bg-white pl-9 pr-3 text-xs text-[#111111] outline-none transition-colors placeholder:text-[var(--cal-text-muted)] focus:border-[#0E9F8D] focus:ring-2 focus:ring-[#0E9F8D]/20"
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        {properties.length === 0 ? (
          <p className="p-6 text-center text-xs text-[var(--cal-text-secondary)]">
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
