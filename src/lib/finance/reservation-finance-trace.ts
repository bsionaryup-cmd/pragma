import {
  AirbnbEmailEventKind,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";

/** Eventos que pueden aportar montos contables a finanzas. */
export const FINANCE_REVENUE_EMAIL_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
]);

export function isFinanceRevenueEmailEvent(
  eventKind: AirbnbEmailEventKind,
  reservationStatus: ReservationStatus,
): boolean {
  if (eventKind === AirbnbEmailEventKind.CANCELED) {
    return reservationStatus === ReservationStatus.CANCELLED;
  }
  return FINANCE_REVENUE_EMAIL_EVENT_KINDS.has(eventKind);
}

export type FinanceRevenueEmailEventRow = {
  reservationId: string | null;
  eventKind: AirbnbEmailEventKind;
  enrichedFields: unknown;
  payload: unknown;
};

export function pickFinanceRevenueEmailEvents<
  T extends FinanceRevenueEmailEventRow,
>(
  rows: T[],
  reservationStatusById: Map<string, ReservationStatus>,
): Map<string, T> {
  const FINANCIAL_EVENT_PRIORITY: Partial<Record<AirbnbEmailEventKind, number>> =
    {
      [AirbnbEmailEventKind.UPDATED]: 40,
      [AirbnbEmailEventKind.EXTENDED]: 30,
      [AirbnbEmailEventKind.CHECKIN_REMINDER]: 20,
      [AirbnbEmailEventKind.CONFIRMED]: 10,
      [AirbnbEmailEventKind.CANCELED]: 0,
    };

  function hostPayoutFromRow(row: T): number {
    const payload = row.payload as { signals?: Record<string, unknown> } | null;
    const signals = payload?.signals ?? {};
    const enriched = (row.enrichedFields ?? {}) as Record<string, unknown>;
    for (const key of ["hostPayoutAmount", "netPayout", "grossAmount"]) {
      const value = Number(enriched[key] ?? signals[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.reservationId) continue;
    const status =
      reservationStatusById.get(row.reservationId) ??
      ReservationStatus.CONFIRMED;
    if (!isFinanceRevenueEmailEvent(row.eventKind, status)) continue;
    const list = grouped.get(row.reservationId) ?? [];
    list.push(row);
    grouped.set(row.reservationId, list);
  }

  const picked = new Map<string, T>();
  for (const [reservationId, list] of grouped) {
    const best = [...list].sort((a, b) => {
      const priorityDiff =
        (FINANCIAL_EVENT_PRIORITY[b.eventKind] ?? 0) -
        (FINANCIAL_EVENT_PRIORITY[a.eventKind] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return hostPayoutFromRow(b) - hostPayoutFromRow(a);
    })[0];
    if (best) picked.set(reservationId, best);
  }
  return picked;
}

export function isReservationFinanceTraceable(input: {
  platform: BookingPlatform;
  totalAmount: unknown;
  icalUid?: string | null;
  reservationCode?: string | null;
}): boolean {
  const stored = Number(input.totalAmount?.toString?.() ?? input.totalAmount);
  if (Number.isFinite(stored) && stored > 0) return true;

  if (input.platform === BookingPlatform.DIRECT) {
    return Number.isFinite(stored) && stored > 0;
  }

  const hasIcal = Boolean(input.icalUid?.trim());
  const hasCode = Boolean(input.reservationCode?.trim());
  return hasIcal && hasCode;
}
