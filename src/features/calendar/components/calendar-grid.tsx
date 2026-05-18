"use client";

import { memo } from "react";
import { CalendarPropertyRow } from "@/features/calendar/components/calendar-property-row";
import type {
  CalendarDateSelection,
  CalendarDayMeta,
  CalendarPropertyDto,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";

type CalendarGridProps = {
  properties: CalendarPropertyDto[];
  reservationsByProperty: Map<string, CalendarReservationDto[]>;
  days: CalendarDayMeta[];
  rangeStart: string;
  gridWidth: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  canWrite: boolean;
  selection: CalendarDateSelection | null;
  onDayClick: (propertyId: string, dateKey: string) => void;
};

function CalendarGridComponent({
  properties,
  reservationsByProperty,
  days,
  rangeStart,
  gridWidth,
  scrollRef,
  onScroll,
  canWrite,
  selection,
  onDayClick,
}: CalendarGridProps) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-auto"
    >
      {properties.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No hay propiedades activas para mostrar.
        </div>
      ) : (
        properties.map((property, index) => (
          <CalendarPropertyRow
            key={property.id}
            propertyId={property.id}
            reservations={reservationsByProperty.get(property.id) ?? []}
            days={days}
            rangeStart={rangeStart}
            gridWidth={gridWidth}
            rowIndex={index}
            canWrite={canWrite}
            selection={selection}
            onDayClick={onDayClick}
          />
        ))
      )}
    </div>
  );
}

export const CalendarGrid = memo(CalendarGridComponent);
