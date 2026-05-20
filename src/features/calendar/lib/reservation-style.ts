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
  "absolute top-1/2 z-20 flex h-8 min-w-[28px] -translate-y-1/2 cursor-pointer items-center gap-1.5 overflow-hidden border border-white/10 bg-[#1B1F23] px-2 text-[11px] font-medium leading-tight text-[#F8F9FA] shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-shadow duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.45)] pointer-events-auto";

export function getReservationBarClasses(state: ReservationVisualState): string {
  switch (state) {
    case "in_stay":
      return `${pillBase} border-l-[3px] border-l-[#14B8A6]`;
    case "checkout_today":
      return `${pillBase} border-l-[3px] border-l-[#F5A524]`;
    case "checked_out":
      return `${pillBase} border-l-[3px] border-l-[#4B5563] bg-[#15181c] text-[#9CA3AF] opacity-80`;
    case "blocked":
      return `${pillBase} border-l-[3px] border-l-[#6B7280] bg-[#15181c] text-[#9CA3AF]`;
    case "confirmed":
    default:
      return `${pillBase} border-l-[3px] border-l-[#0E9F8D]`;
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
