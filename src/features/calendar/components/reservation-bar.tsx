"use client";

import { memo } from "react";
import { PlatformIcon } from "@/features/calendar/components/platform-icon";
import {
  getReservationBarShellClasses,
  getReservationStickyNameClasses,
  getReservationVisualState,
  getStatusLabel,
  reservationBarTrackClasses,
} from "@/features/calendar/lib/reservation-style";
import type {
  CalendarReservationDto,
  ReservationSpan,
} from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

type ReservationBarProps = {
  reservation: CalendarReservationDto;
  span: ReservationSpan;
  onSelect: (reservationId: string) => void;
};

function ReservationBarComponent({
  reservation,
  span,
  onSelect,
}: ReservationBarProps) {
  const visualState = getReservationVisualState(reservation);

  function openReservationDetail(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(reservation.id);
  }

  const roundStart = span.roundedStart ? "rounded-l-full" : "rounded-l-none";
  const roundEnd = span.roundedEnd ? "rounded-r-full" : "rounded-r-none";

  return (
    <button
      type="button"
      className={cn(reservationBarTrackClasses, "text-left")}
      style={{ left: span.leftPx, width: span.widthPx }}
      title={`${reservation.guestName} · ${getStatusLabel(reservation.status)}`}
      onClick={openReservationDetail}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span
        aria-hidden
        className={cn(getReservationBarShellClasses(visualState), roundStart, roundEnd)}
      />
      <span className={getReservationStickyNameClasses(visualState)}>
        {visualState !== "checked_out" ? (
          <PlatformIcon
            platform={reservation.platform}
            size="xs"
            className="shrink-0 opacity-90"
          />
        ) : null}
        <span className="truncate">{reservation.guestName}</span>
      </span>
    </button>
  );
}

export const ReservationBar = memo(ReservationBarComponent);
