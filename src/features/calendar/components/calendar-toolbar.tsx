"use client";

import { ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import {
  formatViewportRangeLabel,
  getTodayKey,
  shiftAnchor,
} from "@/features/calendar/lib/calendar-dates";
import type { CalendarViewport } from "@/features/calendar/types/calendar.types";
import { AirbnbSyncStatus } from "@/components/airbnb/airbnb-sync-status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_SHIFT_DAYS = 21;

type CalendarToolbarProps = {
  viewport: CalendarViewport;
  canSyncAirbnb?: boolean;
  onToggleProperties?: () => void;
  showPropertiesToggle?: boolean;
};

function CalendarToolbarComponent({
  viewport,
  canSyncAirbnb = false,
  onToggleProperties,
  showPropertiesToggle = false,
}: CalendarToolbarProps) {
  const label = formatViewportRangeLabel(viewport);
  const today = getTodayKey();
  const prevAnchor = shiftAnchor(viewport.anchor, -NAV_SHIFT_DAYS);
  const nextAnchor = shiftAnchor(viewport.anchor, NAV_SHIFT_DAYS);
  const isOnToday = viewport.anchor === today;

  return (
    <div className="flex min-h-[var(--cal-toolbar-height,3rem)] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--cal-border)] bg-white px-3 py-2 shadow-pragma-soft sm:gap-3 sm:px-5 sm:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
        {showPropertiesToggle ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg border-[var(--cal-border)] bg-white hover:bg-[var(--cal-bg-hover)] lg:hidden"
            onClick={onToggleProperties}
            aria-label="Ver propiedades"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border-[var(--cal-border)] bg-white hover:bg-[var(--cal-bg-hover)]"
          asChild
        >
          <Link
            href={`/calendar?anchor=${prevAnchor}`}
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border-[var(--cal-border)] bg-white hover:bg-[var(--cal-bg-hover)]"
          asChild
        >
          <Link
            href={`/calendar?anchor=${nextAnchor}`}
            aria-label="Período siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 rounded-lg border-[var(--cal-border)] bg-white px-4 text-xs font-medium hover:bg-[var(--cal-bg-hover)]",
            isOnToday && "opacity-60",
          )}
          asChild={!isOnToday}
          disabled={isOnToday}
        >
          {isOnToday ? (
            <span>Hoy</span>
          ) : (
            <Link href="/calendar">Hoy</Link>
          )}
        </Button>
      </div>

      <h2 className="order-3 w-full truncate text-center text-sm font-semibold tracking-tight text-[#111111] sm:order-none sm:w-auto sm:flex-1 sm:px-2">
        {label}
      </h2>

      <div className="flex shrink-0 flex-col items-end gap-1 sm:min-w-[7rem]">
        {canSyncAirbnb ? (
          <AirbnbSyncStatus canSync compact className="justify-end" />
        ) : (
          <p className="text-[11px] text-[var(--cal-text-secondary)] tabular-nums">
            {today}
          </p>
        )}
      </div>
    </div>
  );
}

export const CalendarToolbar = memo(CalendarToolbarComponent);
