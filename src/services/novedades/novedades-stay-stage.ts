import { ReservationStatus } from "@prisma/client";
import { prismaDateToKey } from "@/lib/dates";
import type { NovedadesStayStageLabel } from "@/services/novedades/novedades-inbox.types";

export type NovedadesStayStage =
  | "NEW_BOOKING"
  | "PRE_ARRIVAL"
  | "CHECK_IN_DAY"
  | "IN_STAY"
  | "CHECKOUT_DAY"
  | "POST_STAY"
  | "CANCELLED";

const STAY_STAGE_LABELS: Record<NovedadesStayStage, NovedadesStayStageLabel> = {
  NEW_BOOKING: "Nueva reserva",
  PRE_ARRIVAL: "Pre-llegada",
  CHECK_IN_DAY: "Día de check-in",
  IN_STAY: "En estadía",
  CHECKOUT_DAY: "Día de salida",
  POST_STAY: "Finalizada",
  CANCELLED: "Cancelada",
};

function parseDateKey(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

function dayDiff(fromKey: string, toKey: string): number {
  const ms = parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function detectNovedadesStayStage(input: {
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  now?: Date;
}): NovedadesStayStage {
  if (input.status === ReservationStatus.CANCELLED) return "CANCELLED";
  if (input.status === ReservationStatus.CHECKED_OUT) return "POST_STAY";

  const today = prismaDateToKey(input.now ?? new Date());

  if (
    input.status === ReservationStatus.CHECKOUT_TODAY ||
    compareDateKeys(today, input.checkOut) === 0
  ) {
    return "CHECKOUT_DAY";
  }

  if (compareDateKeys(today, input.checkIn) === 0) {
    return "CHECK_IN_DAY";
  }

  if (
    input.status === ReservationStatus.CHECKED_IN ||
    (compareDateKeys(today, input.checkIn) > 0 &&
      compareDateKeys(today, input.checkOut) < 0)
  ) {
    return "IN_STAY";
  }

  const daysToCheckIn = dayDiff(today, input.checkIn);
  if (daysToCheckIn > 7) return "NEW_BOOKING";
  if (daysToCheckIn > 0) return "PRE_ARRIVAL";

  return "PRE_ARRIVAL";
}

export function novedadesStayStageLabel(stage: NovedadesStayStage): NovedadesStayStageLabel {
  return STAY_STAGE_LABELS[stage];
}
