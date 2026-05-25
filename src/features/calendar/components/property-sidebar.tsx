"use client";

import { ArrowUpDown, Building2, Search } from "lucide-react";
import Image from "next/image";
import { memo } from "react";
import {
  CALENDAR_DAY_HEADER_HEIGHT,
  CALENDAR_ROW_HEIGHT,
  CALENDAR_SIDEBAR_WIDTH,
} from "@/features/calendar/constants";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import type { CalendarViewSettings } from "@/features/calendar/lib/calendar-view-settings";
import type { CalendarPropertyDto } from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

const rowStyle: React.CSSProperties = {
  height: CALENDAR_ROW_HEIGHT,
  minHeight: CALENDAR_ROW_HEIGHT,
  maxHeight: CALENDAR_ROW_HEIGHT,
  boxSizing: "border-box",
};

function formatPropertyRef(id: string): string {
  const compact = id.replace(/[^a-zA-Z0-9]/g, "");
  return compact.slice(-6) || id.slice(0, 6);
}

type PropertySidebarProps = {
  properties: CalendarPropertyDto[];
  search: string;
  onSearchChange: (value: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  viewSettings: CalendarViewSettings;
};

function PropertySidebarItem({
  property,
  viewSettings,
}: {
  property: CalendarPropertyDto;
  viewSettings: CalendarViewSettings;
}) {
  const unit = formatCalendarUnitDisplay(
    resolveCalendarUnitLabel(property),
  );
  const hasTextContent =
    viewSettings.showInternalName ||
    viewSettings.showIdentificationNumber;

  return (
    <div
      className="flex items-center gap-3 border-b border-[var(--cal-row-divider)] px-3 transition-colors hover:bg-[var(--cal-bg-hover)]"
      style={rowStyle}
    >
      {viewSettings.showImage ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--cal-bg-thumbnail)]">
          {property.coverImageUrl ? (
            <Image
              src={property.coverImageUrl}
              alt={property.name}
              fill
              className="object-cover"
              sizes="48px"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-4 w-4 text-[var(--cal-text-muted)]" />
            </div>
          )}
        </div>
      ) : null}
      {hasTextContent ? (
        <div className="min-w-0 flex-1">
          {viewSettings.showInternalName ? (
            <p className="truncate text-[13px] font-semibold leading-snug text-[var(--cal-text-day)]">
              {property.name}
            </p>
          ) : null}
          {viewSettings.showIdentificationNumber && unit !== "—" ? (
            <p
              className={cn(
                "truncate text-[11px] font-normal leading-tight text-[var(--cal-text-secondary)]",
                viewSettings.showInternalName && "mt-0.5",
              )}
            >
              Apto {unit}
            </p>
          ) : null}
          {viewSettings.showIdentificationNumber ? (
            <p
              className={cn(
                "truncate text-[10px] font-normal leading-tight tabular-nums text-[var(--cal-text-muted)]",
                (viewSettings.showInternalName ||
                  (viewSettings.showIdentificationNumber && unit !== "—")) &&
                  "mt-0.5",
              )}
            >
              {formatPropertyRef(property.id)}
            </p>
          ) : null}
        </div>
      ) : null}
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
  viewSettings,
}: PropertySidebarProps) {
  return (
    <aside
      className="flex shrink-0 flex-col border-r border-[var(--cal-border)] bg-white"
      style={{ width: CALENDAR_SIDEBAR_WIDTH }}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b border-[var(--cal-row-divider)] px-3"
        style={{
          height: CALENDAR_DAY_HEADER_HEIGHT,
          minHeight: CALENDAR_DAY_HEADER_HEIGHT,
          boxSizing: "border-box",
        }}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--cal-text-muted)]" aria-hidden />
          <span className="hidden text-[12px] font-medium text-[var(--cal-text-secondary)] xl:inline">
            Ordenar alojamientos
          </span>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cal-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar..."
            className="h-7 w-full rounded-md border border-[var(--cal-border)] bg-white pl-7 pr-2 text-[12px] text-[var(--cal-text-day)] outline-none transition-colors placeholder:text-[var(--cal-text-muted)] focus:border-[var(--cal-border-strong)]"
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        {properties.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--cal-text-secondary)]">
            Sin propiedades
          </p>
        ) : (
          properties.map((property) => (
            <PropertySidebarItemMemo
              key={property.id}
              property={property}
              viewSettings={viewSettings}
            />
          ))
        )}
      </div>
    </aside>
  );
}

export const PropertySidebar = memo(PropertySidebarComponent);
