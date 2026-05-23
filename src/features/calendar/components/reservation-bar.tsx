"use client";

import { memo } from "react";
import { PlatformIcon } from "@/features/calendar/components/platform-icon";
import {
  getReservationBarClasses,
  getReservationVisualState,
  getStatusLabel,
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

  return (
    <button
      type="button"
      className={cn(
        getReservationBarClasses(visualState),
        "text-left",
        span.roundedStart ? "rounded-l-full" : "rounded-l-none",
        span.roundedEnd ? "rounded-r-full" : "rounded-r-none",
      )}
      style={{ left: span.leftPx, width: span.widthPx }}
      title={`${reservation.guestName} · ${getStatusLabel(reservation.status)}`}
      onClick={openReservationDetail}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <PlatformIcon
        platform={reservation.platform}
        size="sm"
        className="shrink-0"
      />
      <span className="truncate">{reservation.guestName}</span>
    </button>
  );
}

export const ReservationBar = memo(ReservationBarComponent);
