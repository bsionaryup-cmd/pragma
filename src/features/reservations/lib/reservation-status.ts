import type { ReservationStatus } from "@prisma/client";
import { getTodayKey } from "@/features/calendar/lib/calendar-dates";

export type ReservationDisplayStatus =
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "CHECKOUT_TODAY"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "BLOCKED";

export function resolveDisplayStatus(
  status: ReservationStatus,
  checkOut: string,
): ReservationDisplayStatus {
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "CHECKED_OUT") return "CHECKED_OUT";
  if (status === "CHECKOUT_TODAY" || checkOut === getTodayKey()) {
    return "CHECKOUT_TODAY";
  }
  if (status === "CHECKED_IN") return "IN_PROGRESS";
  return "CONFIRMED";
}

export const displayStatusLabels: Record<ReservationDisplayStatus, string> = {
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En curso",
  CHECKOUT_TODAY: "Checkout hoy",
  CHECKED_OUT: "Finalizada",
  CANCELLED: "Cancelada",
  BLOCKED: "Bloqueada",
};

export function getStatusBadgeClass(status: ReservationDisplayStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border-[#008489]/30 bg-[#008489]/10 text-[#008489] dark:text-[#4ecdc4]";
    case "CHECKOUT_TODAY":
      return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "CHECKED_OUT":
      return "border-border bg-muted text-muted-foreground";
    case "CANCELLED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "BLOCKED":
      return "border-zinc-400/40 bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    case "CONFIRMED":
    default:
      return "border-[#ff5a5f]/30 bg-[#ff5a5f]/10 text-[#c1354b] dark:text-[#ff7a7f]";
  }
}
