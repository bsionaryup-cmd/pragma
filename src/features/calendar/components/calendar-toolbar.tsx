"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { CALENDAR_TOOLBAR_HEIGHT } from "@/features/calendar/constants";
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
};

function CalendarToolbarComponent({
  viewport,
  canSyncAirbnb = false,
}: CalendarToolbarProps) {
  const label = formatViewportRangeLabel(viewport);
  const today = getTodayKey();
  const prevAnchor = shiftAnchor(viewport.anchor, -NAV_SHIFT_DAYS);
  const nextAnchor = shiftAnchor(viewport.anchor, NAV_SHIFT_DAYS);
  const isOnToday = viewport.anchor === today;

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--cal-border)] bg-white px-5 shadow-pragma-soft"
      style={{ height: CALENDAR_TOOLBAR_HEIGHT }}
    >
      <div className="flex items-center gap-1.5">
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

      <h2 className="text-sm font-semibold tracking-tight text-[#111111]">
        {label}
      </h2>

      <div className="flex flex-col items-end gap-1">
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
