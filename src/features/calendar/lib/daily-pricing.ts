import type { CalendarDayPricingDto } from "@/features/calendar/types/calendar.types";
import type {
  PriceLabsDailyPrice,
  StoredPriceLabsMeta,
} from "@/integrations/pricelabs/types";

function normalizeDateKey(value: string): string {
  return value.slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function parseDailyPricesFromMeta(
  meta: unknown,
): Record<string, CalendarDayPricingDto> {
  if (!meta || typeof meta !== "object") return {};
  const stored = meta as StoredPriceLabsMeta;
  const days = stored.dailyPrices;
  if (!Array.isArray(days)) return {};

  const map: Record<string, CalendarDayPricingDto> = {};
  for (const row of days as PriceLabsDailyPrice[]) {
    if (!row?.date) continue;
    const date = normalizeDateKey(row.date);
    const nightly =
      toNumber(row.price) ??
      toNumber(row.user_price) ??
      toNumber(row.recommended_price);
    const recommended = toNumber(row.recommended_price) ?? nightly;
    const base =
      toNumber(row.uncustomized_price) ?? toNumber(row.user_price) ?? nightly;
    const status = row.booking_status?.toLowerCase() ?? null;
    const isBooked =
      status === "booked" || status === "reserved" || status === "blocked";

    map[date] = {
      date,
      nightlyPrice: nightly,
      recommendedPrice: recommended,
      basePrice: base,
      minStay: toNumber(row.min_stay),
      bookingStatus: row.booking_status ?? null,
      demandColor:
        typeof row.demand_color === "string" ? row.demand_color : null,
      isBooked,
    };
  }
  return map;
}

export function formatCompactPrice(value: number | null): string {
  if (value == null) return "";
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}
