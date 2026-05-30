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
};

function CalendarDayHeaderComponent({
  days,
  gridWidth,
  scrollRef,
}: CalendarDayHeaderProps) {
  return (
    <div
      ref={scrollRef}
      className="pointer-events-none shrink-0 overflow-x-scroll overflow-y-hidden border-b border-[var(--cal-row-divider)] bg-white [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      <div
        className="flex"
        style={{ width: gridWidth, height: CALENDAR_DAY_HEADER_HEIGHT }}
      >
        {days.map((day, index) => (
          <div
            key={day.date}
            className={cn(
              "flex shrink-0 items-center justify-center border-r border-[var(--cal-col-divider)] bg-[var(--cal-header-cell-bg)] text-center",
              index % 2 === 1 && !day.isToday && "bg-[var(--cal-bg-alt)]",
              day.isToday && "bg-[var(--cal-bg-today)]",
              !day.isCurrentMonth && "text-[var(--cal-text-muted)]",
            )}
            style={{ width: CALENDAR_DAY_WIDTH }}
          >
            {day.isToday ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--cal-bg-today-header)] px-2.5 py-1.5 text-xs font-medium lowercase text-white">
                {day.weekdayShort} {day.label}
              </span>
            ) : (
              <span className="text-xs lowercase">
                <span className="text-[var(--cal-text-muted)]">{day.weekdayShort}</span>{" "}
                <span className="font-medium tabular-nums text-[var(--cal-text-day)]">
                  {day.label}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const CalendarDayHeader = memo(CalendarDayHeaderComponent);
