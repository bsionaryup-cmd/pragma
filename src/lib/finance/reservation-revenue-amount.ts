type JsonRecord = Record<string, unknown>;

function readNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readFromJson(source: unknown): number | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as JsonRecord;
  return (
    readNumber(record.hostPayoutAmount) ??
    readNumber(record.netPayout) ??
    readNumber(record.grossAmount) ??
    readNumber(record.guestTotalPaid) ??
    null
  );
}

/** Monto contable de una reserva: totalAmount persistido o señales de email enriquecidas. */
export function resolveReservationRevenueAmount(input: {
  totalAmount: unknown;
  enrichedFields?: unknown;
  payoutNet?: unknown;
}): number {
  const stored = readNumber(input.totalAmount);
  if (stored != null) return stored;

  const fromEnrichment = readFromJson(input.enrichedFields);
  if (fromEnrichment != null) return fromEnrichment;

  const fromPayout = readNumber(input.payoutNet);
  if (fromPayout != null) return fromPayout;

  return 0;
}

export function pickLatestEnrichmentByReservation<
  T extends { reservationId: string | null; enrichedFields: unknown },
>(rows: T[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const row of rows) {
    if (!row.reservationId || map.has(row.reservationId)) continue;
    if (row.enrichedFields) map.set(row.reservationId, row.enrichedFields);
  }
  return map;
}
