"use client";

import { ChevronLeft, ChevronRight, PanelLeft, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import {
  formatMonthYear,
  shiftAnchor,
} from "@/features/calendar/lib/calendar-dates";
import type { CalendarViewport } from "@/features/calendar/types/calendar.types";
import { Button } from "@/components/ui/button";

const NAV_SHIFT_DAYS = 21;

type CalendarToolbarProps = {
  viewport: CalendarViewport;
  displayYear: number;
  displayMonth: number;
  onToggleProperties?: () => void;
  showPropertiesToggle?: boolean;
  canCreate?: boolean;
  onCreateClick?: () => void;
  onGoToToday?: () => void;
  onOpenViewSettings?: () => void;
};

function CalendarToolbarComponent({
  viewport,
  displayYear,
  displayMonth,
  onToggleProperties,
  showPropertiesToggle = false,
  canCreate = false,
  onCreateClick,
  onGoToToday,
  onOpenViewSettings,
}: CalendarToolbarProps) {
  const monthLabel = formatMonthYear(displayYear, displayMonth).toLowerCase();
  const prevAnchor = shiftAnchor(viewport.anchor, -NAV_SHIFT_DAYS);
  const nextAnchor = shiftAnchor(viewport.anchor, NAV_SHIFT_DAYS);

  return (
    <div className="flex min-h-[var(--cal-toolbar-height,3rem)] shrink-0 items-center justify-between gap-2 border-b border-[var(--cal-border)] bg-white px-2 py-2 sm:gap-3 sm:px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {showPropertiesToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md text-[var(--cal-text-secondary)] hover:bg-[var(--cal-bg-hover)] lg:hidden"
            onClick={onToggleProperties}
            aria-label="Buscar alojamientos"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <h2 className="truncate text-sm font-bold tracking-tight text-[var(--cal-text-day)] sm:text-base">
          {monthLabel}
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-[var(--cal-text-secondary)] hover:bg-[var(--cal-bg-hover)]"
          asChild
        >
          <Link href={`/calendar?anchor=${prevAnchor}`} aria-label="Período anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-[var(--cal-text-secondary)] hover:bg-[var(--cal-bg-hover)]"
          asChild
        >
          <Link href={`/calendar?anchor=${nextAnchor}`} aria-label="Período siguiente">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-md px-3 text-xs font-medium text-[var(--cal-text-secondary)] hover:bg-[var(--cal-bg-hover)]"
          onClick={onGoToToday}
        >
          Hoy
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-1 h-9 w-9 shrink-0 rounded-full text-[var(--cal-text-secondary)] hover:bg-[var(--cal-bg-hover)]"
          onClick={onOpenViewSettings}
          aria-label="Personalizar vista del calendario"
        >
          <Settings2 className="h-4 w-4" strokeWidth={2} />
        </Button>
        {canCreate ? (
          <Button
            type="button"
            size="icon"
            className="ml-1 h-9 w-9 shrink-0 rounded-full bg-[var(--cal-text-day)] text-white shadow-sm hover:bg-[var(--cal-text-day)]/90"
            onClick={onCreateClick}
            aria-label="Nueva reserva"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export const CalendarToolbar = memo(CalendarToolbarComponent);
