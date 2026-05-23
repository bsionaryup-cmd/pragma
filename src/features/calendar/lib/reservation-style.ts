import { getTodayKey } from "@/features/calendar/lib/calendar-dates";
import type {
  CalendarReservationDto,
  ReservationVisualState,
} from "@/features/calendar/types/calendar.types";
import type { BookingPlatform, ReservationStatus } from "@prisma/client";

export function getReservationVisualState(
  reservation: CalendarReservationDto,
): ReservationVisualState {
  const today = getTodayKey();
  const checkInKey = reservation.checkIn;
  const checkOutKey = reservation.checkOut;

  if (reservation.status === "BLOCKED") {
    return "blocked";
  }

  if (reservation.status === "CANCELLED") {
    return "checked_out";
  }

  if (reservation.status === "CHECKED_OUT") {
    return "checked_out";
  }

  if (reservation.status === "CHECKOUT_TODAY" || checkOutKey === today) {
    return "checkout_today";
  }

  if (
    reservation.status === "CHECKED_IN" ||
    (checkInKey <= today && checkOutKey > today)
  ) {
    return "in_stay";
  }

  if (reservation.status === "CONFIRMED") {
    return "confirmed";
  }

  return "confirmed";
}

const pillBase =
  "absolute top-1/2 z-20 flex h-11 min-w-[40px] -translate-y-1/2 cursor-pointer items-center gap-2 overflow-hidden border border-[var(--cal-border)] bg-white px-2.5 text-sm font-medium leading-tight text-[#111111] shadow-[0_1px_3px_rgba(8,22,38,0.1)] transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(8,22,38,0.14)] pointer-events-auto";

export function getReservationBarClasses(state: ReservationVisualState): string {
  switch (state) {
    case "in_stay":
      return `${pillBase} border-l-[3px] border-l-[#14B8A6] bg-[#F0FDFA]`;
    case "checkout_today":
      return `${pillBase} border-l-[3px] border-l-[#F5A524] bg-[#FFFBEB]`;
    case "checked_out":
      return `${pillBase} border-l-[3px] border-l-[#9CA3AF] bg-[var(--cal-reservation-muted-bg)] text-[var(--cal-reservation-muted-text)]`;
    case "blocked":
      return `${pillBase} border-l-[3px] border-l-[#6B7280] bg-[var(--cal-reservation-blocked-bg)] text-[var(--cal-reservation-muted-text)]`;
    case "confirmed":
    default:
      return `${pillBase} border-l-[3px] border-l-[#0E9F8D] bg-[#F0FDF9]`;
  }
}

export function getStatusDotClass(state: ReservationVisualState): string {
  switch (state) {
    case "in_stay":
      return "bg-[#14B8A6]";
    case "checkout_today":
      return "bg-[#F5A524]";
    case "checked_out":
      return "bg-[#6B7280]";
    case "blocked":
      return "bg-[#9CA3AF]";
    case "confirmed":
    default:
      return "bg-[#0E9F8D]";
  }
}

export function getStatusLabel(status: ReservationStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "Confirmada";
    case "CHECKED_IN":
      return "En estancia";
    case "CHECKOUT_TODAY":
      return "Checkout hoy";
    case "CHECKED_OUT":
      return "Finalizada";
    case "CANCELLED":
      return "Cancelada";
    case "BLOCKED":
      return "Bloqueada";
    default:
      return status;
  }
}

export function getPlatformAccent(platform: BookingPlatform): string {
  switch (platform) {
    case "AIRBNB":
      return "text-[#ff5a5f]";
    case "BOOKING":
      return "text-[#003580]";
    default:
      return "text-[#9CA3AF]";
  }
}
