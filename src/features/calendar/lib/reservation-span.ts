import { CALENDAR_DAY_WIDTH } from "@/features/calendar/constants";
import {
  addDaysToKey,
  differenceInCalendarDays,
  parseDateKey,
} from "@/features/calendar/lib/calendar-dates";
import type {
  CalendarReservationDto,
  ReservationSpan,
} from "@/features/calendar/types/calendar.types";

/** Mitad de celda: check-in/check-out ocurren a mediodía (estilo Lodgify). */
const HALF_DAY = CALENDAR_DAY_WIDTH / 2;

/**
 * Noches ocupadas: check-in inclusive, check-out exclusive (estándar PMS).
 * Visualmente la barra empieza a mitad del día de entrada y termina a mitad del día de salida.
 */
export function computeReservationSpan(
  reservation: CalendarReservationDto,
  rangeStartKey: string,
  dayKeys: readonly string[],
): ReservationSpan | null {
  const checkInKey = reservation.checkIn;
  const checkOutKey = reservation.checkOut;
  const rangeEndKey = dayKeys[dayKeys.length - 1];

  if (checkOutKey <= rangeStartKey || checkInKey > rangeEndKey) {
    return null;
  }

  const visibleStartKey =
    checkInKey < rangeStartKey ? rangeStartKey : checkInKey;
  const visibleEndExclusive =
    checkOutKey > addDaysToKey(rangeEndKey, 1)
      ? addDaysToKey(rangeEndKey, 1)
      : checkOutKey;

  const rangeStart = parseDateKey(rangeStartKey);
  const visibleStart = parseDateKey(visibleStartKey);
  const visibleEnd = parseDateKey(visibleEndExclusive);

  const startCol = Math.max(
    0,
    differenceInCalendarDays(visibleStart, rangeStart),
  );
  const endCol = differenceInCalendarDays(visibleEnd, rangeStart);
  const spanCols = Math.max(1, endCol - startCol);

  if (startCol >= dayKeys.length || startCol + spanCols <= 0) {
    return null;
  }

  const clippedSpan = Math.min(spanCols, dayKeys.length - startCol);
  const continuesFromPast = checkInKey < rangeStartKey;
  const continuesToFuture = checkOutKey > addDaysToKey(rangeEndKey, 1);

  const leftPx =
    startCol * CALENDAR_DAY_WIDTH + (continuesFromPast ? 0 : HALF_DAY);
  const rightPx = continuesToFuture
    ? (startCol + clippedSpan) * CALENDAR_DAY_WIDTH
    : endCol * CALENDAR_DAY_WIDTH + HALF_DAY;
  const widthPx = Math.max(HALF_DAY, rightPx - leftPx);

  return {
    reservationId: reservation.id,
    startCol,
    spanCols: clippedSpan,
    leftPx,
    widthPx,
    roundedStart: !continuesFromPast,
    roundedEnd: !continuesToFuture,
  };
}

export function groupReservationsByProperty(
  reservations: CalendarReservationDto[],
): Map<string, CalendarReservationDto[]> {
  const map = new Map<string, CalendarReservationDto[]>();

  for (const reservation of reservations) {
    const list = map.get(reservation.propertyId) ?? [];
    list.push(reservation);
    map.set(reservation.propertyId, list);
  }

  return map;
}
