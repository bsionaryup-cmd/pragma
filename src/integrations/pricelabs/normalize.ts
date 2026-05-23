import type {
  PriceLabsDailyPrice,
  PriceLabsListingRecord,
  PriceLabsListingPricesRow,
  PriceLabsOverrideRecord,
} from "@/integrations/pricelabs/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function normalizeListingRecord(raw: unknown): PriceLabsListingRecord | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    pickString(record, ["id", "listing_id", "listingId"]) ??
    pickNumber(record, ["id", "listing_id"])?.toString();
  if (!id) return null;

  return {
    id,
    pms: pickString(record, ["pms", "PMS"]),
    name: pickString(record, ["name", "listing_name", "title"]),
    city: pickString(record, ["city", "city_name", "cityName"]),
    country: pickString(record, ["country"]),
    bedrooms: pickNumber(record, [
      "bedrooms",
      "bedroom",
      "no_of_bedrooms",
      "noOfBedrooms",
    ]),
    min: pickNumber(record, ["min", "min_price", "minimum"]),
    base: pickNumber(record, ["base", "base_price", "base_rate"]),
    max: pickNumber(record, ["max", "max_price", "maximum"]),
    recommended_base_price: pickNumber(record, [
      "recommended_base_price",
      "recommended_price",
      "recommended_base",
    ]),
    occupancy: pickNumber(record, ["occupancy", "occupancy_rate"]),
    revenue: pickNumber(record, ["revenue", "revenue_ytd"]),
    sync_status: pickString(record, ["sync_status", "sync", "status"]),
    last_refreshed: pickString(record, [
      "last_refreshed",
      "last_refreshed_at",
      "last_sync",
    ]),
    raw: record,
  };
}

export function normalizeListingsResponse(payload: unknown): PriceLabsListingRecord[] {
  if (Array.isArray(payload)) {
    return payload
      .map(normalizeListingRecord)
      .filter((r): r is PriceLabsListingRecord => r != null);
  }
  const record = asRecord(payload);
  if (!record) return [];
  const list = record.listings ?? record.data ?? record.results;
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeListingRecord)
    .filter((r): r is PriceLabsListingRecord => r != null);
}

export function normalizeDailyPrice(raw: unknown): PriceLabsDailyPrice | null {
  const record = asRecord(raw);
  if (!record) return null;
  const date = pickString(record, ["date", "day", "calendar_date"]);
  if (!date) return null;
  return {
    date: date.slice(0, 10),
    price: pickNumber(record, ["price", "nightly_price", "rate"]),
    user_price: pickNumber(record, ["user_price", "your_price", "custom_price"]),
    recommended_price: pickNumber(record, [
      "recommended_price",
      "recommended",
      "suggested_price",
    ]),
    min_stay: pickNumber(record, ["min_stay", "minimum_stay", "min_nights"]),
    weekly_discount: pickNumber(record, ["weekly_discount", "weekly_discount_pct"]),
    monthly_discount: pickNumber(record, ["monthly_discount", "monthly_discount_pct"]),
    booking_status: pickString(record, ["booking_status", "status"]),
    check_in: record.check_in === true || record.checkin === true,
    check_out: record.check_out === true || record.checkout === true,
    demand_level: pickString(record, ["demand_level", "demand"]),
    demand_color: pickString(record, ["demand_color", "color"]),
    pricing_reason: pickString(record, ["pricing_reason", "reason"]),
    uncustomized_price: pickNumber(record, ["uncustomized_price", "base_price"]),
    raw: record,
  };
}

export function normalizeListingPricesRow(
  raw: unknown,
): { listingId: string; days: PriceLabsDailyPrice[]; error?: string; code?: string } | null {
  const record = asRecord(raw);
  if (!record) return null;
  const listingId =
    pickString(record, ["listing_id", "id", "listingId"]) ?? "";
  if (!listingId) return null;

  const error = pickString(record, ["error", "message"]);
  const code = pickString(record, ["code", "error_code"]);
  const daysRaw =
    record.data ?? record.prices ?? record.days ?? record.calendar;
  const days = Array.isArray(daysRaw)
    ? daysRaw
        .map(normalizeDailyPrice)
        .filter((d): d is PriceLabsDailyPrice => d != null)
    : [];

  return { listingId, days, error, code };
}

export function normalizeListingPricesResponse(
  payload: unknown,
): PriceLabsListingPricesRow[] {
  if (Array.isArray(payload)) {
    return payload
      .map(normalizeListingPricesRow)
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({
        listing_id: r.listingId,
        id: r.listingId,
        data: r.days,
        error: r.error,
        code: r.code,
      }));
  }
  const record = asRecord(payload);
  if (!record) return [];
  const rows = record.listings ?? record.data ?? record.results;
  if (!Array.isArray(rows)) return [];
  return rows
    .map(normalizeListingPricesRow)
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      listing_id: r.listingId,
      id: r.listingId,
      data: r.days,
      error: r.error,
      code: r.code,
    }));
}

export function normalizeOverridesResponse(
  payload: unknown,
): PriceLabsOverrideRecord[] {
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : record
      ? (record.overrides ?? record.data)
      : null;
  if (!Array.isArray(list)) return [];

  const out: PriceLabsOverrideRecord[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const date = pickString(row, ["date", "day"]);
    if (!date) continue;
    out.push({
      date: date.slice(0, 10),
      price: pickNumber(row, ["price", "override_price"]),
      min_stay: pickNumber(row, ["min_stay", "minimum_stay"]),
      min_price: pickNumber(row, ["min_price"]),
      max_price: pickNumber(row, ["max_price"]),
      check_in: row.check_in === true,
      check_out: row.check_out === true,
      raw: row,
    });
  }
  return out;
}

export function isBenignListingError(code?: string, message?: string): boolean {
  const hay = `${code ?? ""} ${message ?? ""}`.toUpperCase();
  return (
    hay.includes("LISTING_NO_DATA") ||
    hay.includes("LISTING_NOT_PRESENT") ||
    hay.includes("LISTING_TOGGLE_OFF") ||
    hay.includes("TOGGLE_OFF") ||
    hay.includes("NO_DATA")
  );
}
