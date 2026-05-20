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
      return "border-success/30 bg-success/10 text-success";
    case "CHECKOUT_TODAY":
      return "border-warning/40 bg-warning/15 text-warning";
    case "CHECKED_OUT":
      return "border-border bg-muted text-muted-foreground";
    case "CANCELLED":
      return "border-danger/30 bg-danger/10 text-danger";
    case "BLOCKED":
      return "border-border bg-muted text-text-subtle";
    case "CONFIRMED":
    default:
      return "border-primary/30 bg-primary/10 text-primary";
  }
}
