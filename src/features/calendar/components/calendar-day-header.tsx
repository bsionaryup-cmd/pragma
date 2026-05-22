"use client";

import { memo } from "react";
import {
  CALENDAR_DAY_HEADER_HEIGHT,
  CALENDAR_DAY_WIDTH,
} from "@/features/calendar/constants";
import type { CalendarDayMeta } from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

type CalendarDayHeaderProps = {
  days: CalendarDayMeta[];
  gridWidth: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
};

function CalendarDayHeaderComponent({
  days,
  gridWidth,
  scrollRef,
  onScroll,
}: CalendarDayHeaderProps) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-[var(--cal-border)] bg-white [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      <div
        className="flex"
        style={{ width: gridWidth, height: CALENDAR_DAY_HEADER_HEIGHT }}
      >
        {days.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center border-r border-[var(--cal-border)] text-center",
              day.isWeekend && "bg-[var(--cal-bg-weekend)]",
              !day.isCurrentMonth && "text-[var(--cal-text-muted)]",
              day.isToday && "bg-[var(--cal-bg-today-header)]",
            )}
            style={{ width: CALENDAR_DAY_WIDTH }}
          >
            <span
              className={cn(
                "text-[11px] lowercase tracking-wide",
                day.isToday
                  ? "font-semibold text-[#111111]"
                  : "text-[var(--cal-text-secondary)]",
              )}
            >
              {day.weekdayShort}
            </span>
            {day.isToday ? (
              <span className="mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#0E9F8D] px-1.5 text-xs font-semibold tabular-nums text-white">
                {day.label}
              </span>
            ) : (
              <span className="mt-0.5 text-xs tabular-nums text-[var(--cal-text-day)]">
                {day.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const CalendarDayHeader = memo(CalendarDayHeaderComponent);
