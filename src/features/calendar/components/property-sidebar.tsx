"use client";

import { ArrowUpDown, Building2, Search } from "lucide-react";
import Image from "next/image";
import { memo } from "react";
import {
  CALENDAR_DAY_HEADER_HEIGHT,
  CALENDAR_ROW_HEIGHT,
  CALENDAR_SIDEBAR_WIDTH,
  CALENDAR_SIDEBAR_WIDTH_COMPACT,
} from "@/features/calendar/constants";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import { formatPropertyCapacityLabel } from "@/features/calendar/lib/property-capacity";
import type { CalendarViewSettings } from "@/features/calendar/lib/calendar-view-settings";
import type { CalendarPropertyDto } from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

const rowStyle: React.CSSProperties = {
  height: CALENDAR_ROW_HEIGHT,
  minHeight: CALENDAR_ROW_HEIGHT,
  maxHeight: CALENDAR_ROW_HEIGHT,
  boxSizing: "border-box",
};

function PropertyCapacityIndicator({
  maxGuests,
  compact = false,
}: {
  maxGuests: number | null | undefined;
  compact?: boolean;
}) {
  const label = formatPropertyCapacityLabel(maxGuests);
  if (!label) return null;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums leading-none text-[var(--cal-text-secondary)]",
        compact ? "text-[9px]" : "text-[11px]",
      )}
      title={`Capacidad máxima: ${maxGuests} huéspedes`}
    >
      <span aria-hidden>👤</span>
      <span>{label}</span>
    </p>
  );
}

type PropertySidebarVariant = "full" | "compact";

type PropertySidebarProps = {
  properties: CalendarPropertyDto[];
  search: string;
  onSearchChange: (value: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  viewSettings: CalendarViewSettings;
  variant?: PropertySidebarVariant;
};

function resolvePropertyTitle(
  property: CalendarPropertyDto,
  viewSettings: CalendarViewSettings,
  unitLabel: string,
): string {
  if (viewSettings.showIdentificationNumber && unitLabel !== "—") {
    return unitLabel;
  }
  return property.name;
}

function PropertySidebarItem({
  property,
  viewSettings,
  variant = "full",
}: {
  property: CalendarPropertyDto;
  viewSettings: CalendarViewSettings;
  variant?: PropertySidebarVariant;
}) {
  const unit = formatCalendarUnitDisplay(resolveCalendarUnitLabel(property));
  const compact = variant === "compact";
  const title = resolvePropertyTitle(property, viewSettings, unit);
  const showUnitAsTitle =
    viewSettings.showIdentificationNumber && unit !== "—";
  const showNameSubtitle =
    viewSettings.showInternalName && (showUnitAsTitle || !compact);

  if (compact) {
    return (
      <div
        className="flex items-center justify-center border-b border-[var(--cal-row-divider)] px-1 transition-colors"
        style={rowStyle}
        title={`${property.name} · ${formatPropertyCapacityLabel(property.maxGuests) || ""}`}
      >
        <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 leading-tight">
          <p className="truncate text-[13px] font-bold tabular-nums tracking-tight text-[var(--cal-text-day)]">
            {showUnitAsTitle ? unit : property.name}
          </p>
          <PropertyCapacityIndicator maxGuests={property.maxGuests} compact />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 overflow-visible border-b border-[var(--cal-row-divider)] px-3 transition-colors hover:bg-[var(--cal-bg-hover)]"
      style={rowStyle}
    >
      {viewSettings.showImage ? (
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--cal-bg-thumbnail)]">
          {property.coverImageUrl ? (
            <Image
              src={property.coverImageUrl}
              alt={property.name}
              fill
              className="object-cover"
              sizes="44px"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-4 w-4 text-[var(--cal-text-muted)]" />
            </div>
          )}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1">
        <p className="truncate text-[14px] font-semibold leading-tight tracking-tight text-[var(--cal-text-day)]">
          {title}
        </p>
        <PropertyCapacityIndicator maxGuests={property.maxGuests} />
        {showNameSubtitle ? (
          <p className="truncate text-[10px] font-normal leading-tight text-[var(--cal-text-muted)]">
            {property.name}
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
  viewSettings,
  variant = "full",
}: PropertySidebarProps) {
  const compact = variant === "compact";
  const sidebarWidth = compact
    ? CALENDAR_SIDEBAR_WIDTH_COMPACT
    : CALENDAR_SIDEBAR_WIDTH;

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-[var(--cal-border)] bg-white",
        compact && "z-10 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]",
      )}
      style={{ width: sidebarWidth }}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-[var(--cal-row-divider)]",
          compact ? "justify-center px-1" : "gap-2 px-3",
        )}
        style={{
          height: CALENDAR_DAY_HEADER_HEIGHT,
          minHeight: CALENDAR_DAY_HEADER_HEIGHT,
          boxSizing: "border-box",
        }}
      >
        {compact ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cal-text-muted)]">
            Aloj.
          </span>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1.5">
              <ArrowUpDown
                className="h-3.5 w-3.5 shrink-0 text-[var(--cal-text-muted)]"
                aria-hidden
              />
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
          </>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
      >
        {properties.length === 0 ? (
          <p
            className={cn(
              "text-center text-[var(--cal-text-secondary)]",
              compact ? "p-3 text-[10px]" : "p-6 text-sm",
            )}
          >
            Sin propiedades
          </p>
        ) : (
          properties.map((property) => (
            <PropertySidebarItemMemo
              key={property.id}
              property={property}
              viewSettings={viewSettings}
              variant={variant}
            />
          ))
        )}
      </div>
    </aside>
  );
}

export const PropertySidebar = memo(PropertySidebarComponent);
