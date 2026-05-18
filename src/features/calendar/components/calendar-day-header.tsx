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
      className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-border bg-background [&::-webkit-scrollbar]:hidden"
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
              "flex shrink-0 flex-col items-center justify-center border-r border-border/60 text-center",
              day.isWeekend && "bg-muted/25",
              !day.isCurrentMonth && "text-muted-foreground/70",
              day.isToday && "bg-primary/[0.12]",
            )}
            style={{ width: CALENDAR_DAY_WIDTH }}
          >
            <span
              className={cn(
                "text-[10px] lowercase tracking-wide",
                day.isToday
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {day.weekdayShort}
            </span>
            {day.isToday ? (
              <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-foreground px-1 text-[11px] font-semibold tabular-nums text-background">
                {day.label}
              </span>
            ) : (
              <span className="mt-0.5 text-xs tabular-nums">{day.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const CalendarDayHeader = memo(CalendarDayHeaderComponent);
