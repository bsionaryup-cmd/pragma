"use client";

import { memo, useMemo } from "react";
import {
  CALENDAR_DAY_WIDTH,
  CALENDAR_ROW_HEIGHT,
} from "@/features/calendar/constants";
import { computeReservationSpan } from "@/features/calendar/lib/reservation-span";
import { CalendarDayPrice } from "@/features/calendar/components/calendar-day-price";
import { ReservationBar } from "@/features/calendar/components/reservation-bar";
import type {
  CalendarDateSelection,
  CalendarDayMeta,
  CalendarDayPricingDto,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

type CalendarPropertyRowProps = {
  propertyId: string;
  dailyPricesByDate: Record<string, CalendarDayPricingDto>;
  reservations: CalendarReservationDto[];
  days: CalendarDayMeta[];
  rangeStart: string;
  gridWidth: number;
  rowIndex: number;
  canWrite: boolean;
  selection: CalendarDateSelection | null;
  onDayClick: (propertyId: string, dateKey: string) => void;
  onReservationClick: (reservationId: string) => void;
};

function isDayInSelection(
  dateKey: string,
  selection: CalendarDateSelection | null,
  propertyId: string,
): boolean {
  if (!selection || selection.propertyId !== propertyId) return false;
  const { checkIn, checkOut } = selection;
  if (!checkOut) {
    return dateKey === checkIn;
  }
  return dateKey >= checkIn && dateKey < checkOut;
}

function CalendarPropertyRowComponent({
  propertyId,
  dailyPricesByDate,
  reservations,
  days,
  rangeStart,
  gridWidth,
  rowIndex,
  canWrite,
  selection,
  onDayClick,
  onReservationClick,
}: CalendarPropertyRowProps) {
  const dayKeys = useMemo(() => days.map((d) => d.date), [days]);

  const bars = useMemo(
    () =>
      reservations
        .map((reservation) => ({
          reservation,
          span: computeReservationSpan(reservation, rangeStart, dayKeys),
        }))
        .filter(
          (
            item,
          ): item is {
            reservation: CalendarReservationDto;
            span: NonNullable<ReturnType<typeof computeReservationSpan>>;
          } => item.span !== null,
        ),
    [reservations, rangeStart, dayKeys],
  );

  return (
    <div
      className={cn(
        "relative box-border border-b border-border/90",
        rowIndex % 2 === 1 && "bg-[#15181c]/50",
      )}
      style={{
        width: gridWidth,
        height: CALENDAR_ROW_HEIGHT,
        minHeight: CALENDAR_ROW_HEIGHT,
        maxHeight: CALENDAR_ROW_HEIGHT,
        boxSizing: "border-box",
      }}
      data-property-id={propertyId}
    >
      {days.map((day, index) => {
        const selected = isDayInSelection(day.date, selection, propertyId);
        return (
          <button
            key={day.date}
            type="button"
            disabled={!canWrite}
            onClick={() => onDayClick(propertyId, day.date)}
            className={cn(
              "absolute top-0 z-0 border-r border-border/70 transition-colors duration-150",
              day.isWeekend && "bg-[#15181c]/80",
              day.isToday &&
                "z-[1] bg-primary/15 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.35)]",
              selected && "bg-primary/25 ring-1 ring-inset ring-primary/60",
              canWrite && "cursor-crosshair hover:bg-primary/10",
              !canWrite && "cursor-default",
            )}
            style={{
              left: index * CALENDAR_DAY_WIDTH,
              width: CALENDAR_DAY_WIDTH,
              height: CALENDAR_ROW_HEIGHT,
            }}
            aria-label={`${day.date}${selected ? " (seleccionado)" : ""}`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_left,transparent_calc(50%-0.5px),rgba(255,255,255,0.06)_calc(50%-0.5px),rgba(255,255,255,0.06)_calc(50%+0.5px),transparent_calc(50%+0.5px))]"
            />
            <CalendarDayPrice pricing={dailyPricesByDate[day.date]} />
          </button>
        );
      })}

      {bars.map(({ reservation, span }) => (
        <ReservationBar
          key={reservation.id}
          reservation={reservation}
          span={span}
          onSelect={onReservationClick}
        />
      ))}
    </div>
  );
}

export const CalendarPropertyRow = memo(CalendarPropertyRowComponent);
