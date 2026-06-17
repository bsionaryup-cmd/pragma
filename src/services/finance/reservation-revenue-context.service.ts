import "server-only";

import type { ReservationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildReservationRevenueSourcesMapFromEmailEvents,
  type ReservationRevenueSources,
} from "@/lib/finance/reservation-revenue-amount";

export async function loadReservationRevenueSourcesByReservationId(
  reservationIds: string[],
): Promise<Map<string, ReservationRevenueSources>> {
  if (reservationIds.length === 0) return new Map();

  const uniqueIds = [...new Set(reservationIds)];

  const [events, payouts, reservations] = await Promise.all([
    db.reservationEmailEvent.findMany({
      where: { reservationId: { in: uniqueIds } },
      select: {
        reservationId: true,
        eventKind: true,
        enrichedFields: true,
        payload: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reservationPayout.findMany({
      where: { reservationId: { in: uniqueIds } },
      select: {
        reservationId: true,
        netPayout: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.reservation.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true },
    }),
  ]);

  const reservationStatusById = new Map<string, ReservationStatus>(
    reservations.map((row) => [row.id, row.status]),
  );

  const map = buildReservationRevenueSourcesMapFromEmailEvents(
    events,
    reservationStatusById,
  );

  for (const payout of payouts) {
    if (!payout.reservationId) continue;
    const existing = map.get(payout.reservationId) ?? {};
    if (existing.payoutNet != null) continue;
    if (payout.netPayout == null) continue;
    map.set(payout.reservationId, {
      ...existing,
      payoutNet: payout.netPayout,
    });
  }

  return map;
}
