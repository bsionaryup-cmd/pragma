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

export function getReservationBarClasses(state: ReservationVisualState): string {
  const base =
    "absolute top-1.5 z-10 flex h-[calc(100%-10px)] min-w-[28px] cursor-pointer items-center gap-1 overflow-hidden rounded-full border border-border/80 bg-white px-2 text-[11px] font-medium leading-tight text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md";

  switch (state) {
    case "in_stay":
      return `${base} border-l-[3px] border-l-[#008489]`;
    case "checkout_today":
      return `${base} border-l-[3px] border-l-amber-500`;
    case "checked_out":
      return `${base} border-l-[3px] border-l-muted-foreground/40 bg-muted/50 text-muted-foreground`;
    case "blocked":
      return `${base} border-l-[3px] border-l-zinc-500 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`;
    case "confirmed":
    default:
      return `${base} border-l-[3px] border-l-[#ff5a5f]`;
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
      return "text-muted-foreground";
  }
}
