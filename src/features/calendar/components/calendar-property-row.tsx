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
import {
  isDayInOccupancyBandVisual,
  isNightExternallyBooked,
  isNightOccupiedByStays,
  isNightUnavailable,
  isStayRangeAvailable,
} from "@/features/calendar/lib/stay-availability";
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
  rowIndex: _rowIndex,
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
        const pricing = dailyPricesByDate[day.date];
        const isBooked = pricing?.isBooked ?? false;
        const bandShaded = isDayInOccupancyBandVisual(day.date, activeReservations);
        const nightOccupied = isNightOccupiedByStays(day.date, activeReservations);
        const externalBooked = isNightExternallyBooked(
          day.date,
          isBooked,
          activeReservations,
        );
        const unavailable = isNightUnavailable(
          day.date,
          activeReservations,
          isBooked,
        );
        const isCompletingRange =
          selection?.propertyId === propertyId &&
          selection.checkOut === null &&
          day.date > (selection.checkIn ?? "");
        const allowsTurnoverCheckOut =
          isCompletingRange &&
          isStayRangeAvailable(
            selection.checkIn,
            day.date,
            activeReservations,
            (night) => dailyPricesByDate[night]?.isBooked ?? false,
          );
        const selectionBlocked = unavailable && !allowsTurnoverCheckOut;

        return (
          <button
            key={day.date}
            type="button"
            disabled={!canWrite}
            title={unavailable ? "No disponible" : undefined}
            onClick={() => {
              if (!canWrite || selectionBlocked) return;
              onDayClick(propertyId, day.date);
            }}
            onMouseEnter={() => {
              if (isSelectingRange && !selectionBlocked) {
                onDayHover(propertyId, day.date);
              }
            }}
            className={cn(
              "group absolute top-0 z-[2] border-r border-[var(--cal-col-divider)] transition-colors duration-100",
              selected &&
                "z-[3] border-dashed border-[var(--cal-col-divider-selected)] bg-[var(--cal-bg-range-select)]",
              !selected &&
                !bandShaded &&
                !externalBooked &&
                "bg-white",
              !selected &&
                !bandShaded &&
                !externalBooked &&
                index % 2 === 1 &&
                "bg-[var(--cal-bg-alt)]",
              !selected &&
                !bandShaded &&
                !externalBooked &&
                day.isWeekend &&
                index % 2 === 0 &&
                "bg-[var(--cal-bg-weekend)]",
              !selected &&
                !bandShaded &&
                !externalBooked &&
                day.isToday &&
                "bg-[var(--cal-bg-today)]",
              !selected && bandShaded && "bg-transparent",
              canWrite && "cursor-crosshair",
              !canWrite && "cursor-default",
            )}
            style={{
              left: index * CALENDAR_DAY_WIDTH,
              width: CALENDAR_DAY_WIDTH,
              height: CALENDAR_ROW_HEIGHT,
            }}
            aria-label={`${day.date}${
              unavailable ? " (no disponible)" : selected ? " (seleccionado)" : ""
            }`}
            aria-disabled={unavailable || undefined}
          >
            {!selected && !selectionBlocked ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[3px] z-[3] rounded-lg border-2 border-transparent transition-colors group-hover:border-[var(--cal-text-day)]"
              />
            ) : null}
            {!selected && externalBooked ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1] bg-[var(--cal-bg-occupied-external)] opacity-80"
                style={{
                  clipPath: externalBookedClipPath(index),
                  WebkitClipPath: externalBookedClipPath(index),
                }}
              />
            ) : null}
            <CalendarDayPrice
              pricing={pricing}
              highlighted={selected}
              occupied={unavailable}
              showPrice={showPrice && !nightOccupied}
              showMinimumStay={showMinimumStay && !nightOccupied}
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
