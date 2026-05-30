import { prismaDateToKey } from "@/lib/dates";

export const DEFAULT_CHECK_IN_TIME = "15:00";
export const DEFAULT_CHECK_OUT_TIME = "13:00";

const BOGOTA_OFFSET_MINUTES = -5 * 60;

export function parseStayTime(
  value: string | null | undefined,
  fallback: string,
): { hours: number; minutes: number } {
  const raw = (value ?? fallback).trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) {
    const fallbackMatch = /^(\d{1,2}):(\d{2})$/.exec(fallback);
    if (!fallbackMatch) return { hours: 15, minutes: 0 };
    return {
      hours: Number.parseInt(fallbackMatch[1]!, 10),
      minutes: Number.parseInt(fallbackMatch[2]!, 10),
    };
  }
  return {
    hours: Number.parseInt(match[1]!, 10),
    minutes: Number.parseInt(match[2]!, 10),
  };
}

export function localColombiaDateTime(
  dateKey: string,
  hours: number,
  minutes: number,
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utcMs =
    Date.UTC(y, m - 1, d, hours, minutes, 0, 0) -
    BOGOTA_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
}

/** Ventana operativa de estadía: fecha reserva + hora local Colombia. */
export function resolveStayScheduleWindow(input: {
  checkIn: Date;
  checkOut: Date;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}): { validFrom: Date; validTo: Date } {
  const checkInKey = prismaDateToKey(input.checkIn);
  const checkOutKey = prismaDateToKey(input.checkOut);
  const inTime = parseStayTime(input.checkInTime, DEFAULT_CHECK_IN_TIME);
  const outTime = parseStayTime(input.checkOutTime, DEFAULT_CHECK_OUT_TIME);

  return {
    validFrom: localColombiaDateTime(checkInKey, inTime.hours, inTime.minutes),
    validTo: localColombiaDateTime(checkOutKey, outTime.hours, outTime.minutes),
  };
}
