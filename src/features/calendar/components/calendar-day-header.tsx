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
      className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-[#E9ECEF] bg-white [&::-webkit-scrollbar]:hidden"
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
              "flex shrink-0 flex-col items-center justify-center border-r border-[#E9ECEF] text-center",
              day.isWeekend && "bg-[#F3F5F7]",
              !day.isCurrentMonth && "text-[#9CA3AF]",
              day.isToday && "bg-[#E6F7F4]",
            )}
            style={{ width: CALENDAR_DAY_WIDTH }}
          >
            <span
              className={cn(
                "text-[10px] lowercase tracking-wide",
                day.isToday
                  ? "font-semibold text-[#111111]"
                  : "text-[#6B7280]",
              )}
            >
              {day.weekdayShort}
            </span>
            {day.isToday ? (
              <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#0E9F8D] px-1.5 text-[11px] font-semibold tabular-nums text-white">
                {day.label}
              </span>
            ) : (
              <span className="mt-0.5 text-xs tabular-nums text-[#374151]">
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
