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
  "absolute top-[28px] z-20 flex h-[32px] min-w-[36px] cursor-pointer items-center gap-1.5 overflow-hidden rounded-full border border-[var(--cal-pill-border)] bg-white px-2.5 text-xs font-normal leading-none tracking-tight text-[var(--cal-text-day)] shadow-none transition-[box-shadow] duration-150 hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)] pointer-events-auto";

export function getReservationBarClasses(state: ReservationVisualState): string {
  switch (state) {
    case "in_stay":
    case "checkout_today":
    case "confirmed":
    default:
      return pillBase;
    case "checked_out":
      return `${pillBase} border-[var(--cal-border-strong)] bg-[var(--cal-reservation-muted-bg)] text-[var(--cal-reservation-muted-text)]`;
    case "blocked":
      return `${pillBase} border-[var(--cal-border-strong)] bg-[var(--cal-reservation-blocked-bg)] text-[var(--cal-reservation-muted-text)]`;
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
