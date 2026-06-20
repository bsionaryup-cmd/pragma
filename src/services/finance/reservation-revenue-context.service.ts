import "server-only";

import type { ReservationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  pickFinanceRevenueEmailEventsByQuality,
  type FinanceRevenueEmailRawEmail,
} from "@/lib/finance/reservation-finance-trace";
import {
  buildReservationRevenueSourcesFromEmailEvent,
  type ReservationRevenueSources,
} from "@/lib/finance/reservation-revenue-amount";

function readRawEmail(value: unknown): FinanceRevenueEmailRawEmail | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const html = typeof record.html === "string" ? record.html : undefined;
  const text = typeof record.text === "string" ? record.text : undefined;
  if (!html && !text) return null;
  return { html, text };
}

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
        auditId: true,
        eventKind: true,
        enrichedFields: true,
        payload: true,
        audit: {
          select: {
            processedAt: true,
            rawEmail: true,
          },
        },
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
      select: {
        id: true,
        status: true,
        reservationCode: true,
        checkIn: true,
        checkOut: true,
      },
    }),
  ]);

  const reservationStatusById = new Map<string, ReservationStatus>(
    reservations.map((row) => [row.id, row.status]),
  );
  const reservationMetaById = new Map(
    reservations.map((row) => [
      row.id,
      {
        reservationCode: row.reservationCode,
        checkIn: row.checkIn.toISOString().slice(0, 10),
        checkOut: row.checkOut.toISOString().slice(0, 10),
      },
    ]),
  );

  const map = new Map<string, ReservationRevenueSources>();
  const picked = pickFinanceRevenueEmailEventsByQuality(
    events.map((event) => ({
      reservationId: event.reservationId,
      eventKind: event.eventKind,
      enrichedFields: event.enrichedFields,
      payload: event.payload,
      auditId: event.auditId,
      processedAt: event.audit.processedAt,
      rawEmail: readRawEmail(event.audit.rawEmail),
    })),
    reservationStatusById,
    reservationMetaById,
  );

  for (const [reservationId, row] of picked) {
    const meta = reservationMetaById.get(reservationId);
    const raw = row.rawEmail;
    map.set(
      reservationId,
      buildReservationRevenueSourcesFromEmailEvent({
        enrichedFields: row.enrichedFields,
        payload: row.payload,
        confirmationCode: meta?.reservationCode ?? null,
        checkIn: meta?.checkIn ?? null,
        checkOut: meta?.checkOut ?? null,
        emailHtml: raw?.html ?? null,
        emailText: raw?.text ?? null,
      }),
    );
  }

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
