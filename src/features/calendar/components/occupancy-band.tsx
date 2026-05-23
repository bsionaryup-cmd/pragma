"use client";

import { memo } from "react";
import { CALENDAR_ROW_HEIGHT } from "@/features/calendar/constants";
import { computeOccupancyBandClipPath } from "@/features/calendar/lib/reservation-span";
import type { CalendarReservationDto } from "@/features/calendar/types/calendar.types";

type OccupancyBandProps = {
  reservation: CalendarReservationDto;
  allReservations: CalendarReservationDto[];
  rangeStart: string;
  dayKeys: readonly string[];
};

function OccupancyBandComponent({
  reservation,
  allReservations,
  rangeStart,
  dayKeys,
}: OccupancyBandProps) {
  const clipPath = computeOccupancyBandClipPath(
    reservation,
    rangeStart,
    dayKeys,
    allReservations,
    CALENDAR_ROW_HEIGHT,
  );
  if (!clipPath) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] bg-[var(--cal-booked-fill)]"
      style={{
        clipPath,
        WebkitClipPath: clipPath,
      }}
    />
  );
}

export const OccupancyBand = memo(OccupancyBandComponent);
