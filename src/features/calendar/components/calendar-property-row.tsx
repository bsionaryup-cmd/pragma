"use client";

import { memo, useMemo } from "react";
import {
  CALENDAR_DAY_WIDTH,
  CALENDAR_ROW_HEIGHT,
} from "@/features/calendar/constants";
import { OccupancyBand } from "@/features/calendar/components/occupancy-band";
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
  selectionHoverDate: string | null;
  onDayClick: (propertyId: string, dateKey: string) => void;
  onDayHover: (propertyId: string, dateKey: string | null) => void;
  onReservationClick: (reservationId: string) => void;
  showPrice: boolean;
  showMinimumStay: boolean;
};

function isDayInSelectionRange(
  dateKey: string,
  selection: CalendarDateSelection | null,
  propertyId: string,
  hoverDate: string | null,
): boolean {
  if (!selection || selection.propertyId !== propertyId) return false;

  const { checkIn, checkOut } = selection;
  let rangeEnd = checkOut;

  if (!rangeEnd) {
    if (!hoverDate || hoverDate <= checkIn) {
      return dateKey === checkIn;
    }
    rangeEnd = hoverDate;
  }

  return dateKey >= checkIn && dateKey < rangeEnd;
}

function isDayCoveredByReservation(
  dateKey: string,
  reservations: CalendarReservationDto[],
): boolean {
  return reservations.some(
    (r) =>
      r.status !== "CANCELLED" &&
      dateKey >= r.checkIn &&
      dateKey <= r.checkOut,
  );
}

/** Día ocupado solo en PriceLabs (sin reserva PRAGMA) — paralelogramo de una celda */
function externalBookedClipPath(dayIndex: number): string {
  const W = CALENDAR_DAY_WIDTH;
  const H = CALENDAR_ROW_HEIGHT;
  const x = dayIndex * W;
  return `polygon(${x}px ${H}px, ${x + W}px ${H}px, ${x + W}px 0px, ${x}px 0px)`;
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
  selectionHoverDate,
  onDayClick,
  onDayHover,
  onReservationClick,
  showPrice,
  showMinimumStay,
}: CalendarPropertyRowProps) {
  const dayKeys = useMemo(() => days.map((d) => d.date), [days]);

  const activeReservations = useMemo(
    () => reservations.filter((r) => r.status !== "CANCELLED"),
    [reservations],
  );

  const bars = useMemo(
    () =>
      activeReservations
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
    [activeReservations, rangeStart, dayKeys],
  );

  const isSelectingRange =
    canWrite &&
    selection?.propertyId === propertyId &&
    selection.checkOut === null;

  return (
    <div
      className="relative box-border border-b border-[var(--cal-row-divider)] bg-white"
      style={{
        width: gridWidth,
        height: CALENDAR_ROW_HEIGHT,
        minHeight: CALENDAR_ROW_HEIGHT,
        maxHeight: CALENDAR_ROW_HEIGHT,
        boxSizing: "border-box",
      }}
      data-property-id={propertyId}
    >
      {activeReservations.map((reservation) => (
        <OccupancyBand
          key={`band-${reservation.id}`}
          reservation={reservation}
          allReservations={activeReservations}
          rangeStart={rangeStart}
          dayKeys={dayKeys}
        />
      ))}

      {days.map((day, index) => {
        const selected = isDayInSelectionRange(
          day.date,
          selection,
          propertyId,
          selectionHoverDate,
        );
        const showExternalBooked =
          dailyPricesByDate[day.date]?.isBooked &&
          !isDayCoveredByReservation(day.date, activeReservations);

        return (
          <button
            key={day.date}
            type="button"
            disabled={!canWrite}
            onClick={() => onDayClick(propertyId, day.date)}
            onMouseEnter={() => {
              if (isSelectingRange) onDayHover(propertyId, day.date);
            }}
            className={cn(
              "group absolute top-0 z-0 border-r bg-white transition-colors duration-100",
              selected
                ? "z-[2] border-dashed border-[var(--cal-col-divider-selected)] bg-[var(--cal-bg-range-select)]"
                : "border-[var(--cal-col-divider)]",
              !selected && index % 2 === 1 && "bg-[var(--cal-bg-alt)]",
              !selected &&
                day.isWeekend &&
                index % 2 === 0 &&
                "bg-[var(--cal-bg-weekend)]",
              !selected && day.isToday && "bg-[var(--cal-bg-today)]",
              canWrite && "cursor-crosshair",
              !canWrite && "cursor-default",
            )}
            style={{
              left: index * CALENDAR_DAY_WIDTH,
              width: CALENDAR_DAY_WIDTH,
              height: CALENDAR_ROW_HEIGHT,
            }}
            aria-label={`${day.date}${selected ? " (seleccionado)" : ""}`}
          >
            {!selected ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[3px] z-[3] rounded-lg border-2 border-transparent transition-colors group-hover:border-[var(--cal-text-day)]"
              />
            ) : null}
            {!selected && showExternalBooked ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-[var(--cal-booked-fill)]"
                style={{
                  clipPath: externalBookedClipPath(index),
                  WebkitClipPath: externalBookedClipPath(index),
                }}
              />
            ) : null}
            <CalendarDayPrice
              pricing={dailyPricesByDate[day.date]}
              highlighted={selected}
              showPrice={showPrice}
              showMinimumStay={showMinimumStay}
            />
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
