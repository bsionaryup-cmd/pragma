"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
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
};

function ReservationBarComponent({ reservation, span }: ReservationBarProps) {
  const router = useRouter();
  const visualState = getReservationVisualState(reservation);

  function openReservationDetail(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/reservations?reservation=${reservation.id}`);
  }

  return (
    <button
      type="button"
      className={cn(getReservationBarClasses(visualState), "text-left")}
      style={{ left: span.leftPx, width: span.widthPx }}
      title={`${reservation.guestName} · ${getStatusLabel(reservation.status)}`}
      onClick={openReservationDetail}
    >
      <PlatformIcon platform={reservation.platform} />
      <span className="truncate">{reservation.guestName}</span>
    </button>
  );
}

export const ReservationBar = memo(ReservationBarComponent);
