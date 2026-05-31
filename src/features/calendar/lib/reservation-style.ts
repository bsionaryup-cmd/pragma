import type {
  CalendarReservationDto,
  ReservationVisualState,
} from "@/features/calendar/types/calendar.types";
import type { BookingPlatform, ReservationStatus } from "@prisma/client";

export function getReservationVisualState(
  reservation: CalendarReservationDto,
): ReservationVisualState {
  if (reservation.status === "BLOCKED") {
    return "blocked";
  }

  if (reservation.status === "CANCELLED") {
    return "checked_out";
  }

  if (reservation.status === "CHECKED_OUT") {
    return "checked_out";
  }

  if (reservation.status === "CHECKOUT_TODAY") {
    return "checkout_today";
  }

  if (reservation.status === "CHECKED_IN") {
    return "in_stay";
  }

  if (reservation.status === "CONFIRMED") {
    return "confirmed";
  }

  return "confirmed";
}

export const reservationBarTrackClasses =
  "group absolute top-[28px] z-20 flex h-[33px] min-w-[36px] cursor-pointer items-center overflow-visible border-0 bg-transparent p-0 shadow-none pointer-events-auto";

const shellBase =
  "pointer-events-none absolute inset-0 box-border border-2 border-[var(--cal-pill-border)] bg-white transition-[box-shadow] duration-150 group-hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]";

const stickyNameBase =
  "sticky left-0 z-10 inline-flex h-[33px] max-w-full min-w-0 items-center gap-1.5 px-2.5 text-[13px] font-medium leading-none tracking-tight text-[var(--cal-text-day)]";

export function getReservationBarShellClasses(
  state: ReservationVisualState,
): string {
  switch (state) {
    case "in_stay":
    case "checkout_today":
    case "confirmed":
    default:
      return shellBase;
    case "checked_out":
      return `${shellBase} border-[var(--cal-border-strong)] bg-[var(--cal-reservation-muted-bg)]`;
    case "blocked":
      return `${shellBase} border-[var(--cal-border-strong)] bg-[var(--cal-reservation-blocked-bg)]`;
  }
}

export function getReservationStickyNameClasses(
  state: ReservationVisualState,
): string {
  switch (state) {
    case "in_stay":
    case "checkout_today":
    case "confirmed":
    default:
      return `${stickyNameBase} bg-white`;
    case "checked_out":
      return `${stickyNameBase} bg-[var(--cal-reservation-muted-bg)] text-[var(--cal-reservation-muted-text)]`;
    case "blocked":
      return `${stickyNameBase} bg-[var(--cal-reservation-blocked-bg)] text-[var(--cal-reservation-muted-text)]`;
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
