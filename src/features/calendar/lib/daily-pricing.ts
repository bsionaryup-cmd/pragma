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

function resolveNightRate(pricing: CalendarDayPricingDto | undefined): number {
  if (!pricing) return 0;
  return (
    pricing.recommendedPrice ??
    pricing.nightlyPrice ??
    pricing.basePrice ??
    0
  );
}

/** Suma tarifas PriceLabs por noche (check-in inclusive, check-out exclusive). */
export function sumPriceLabsStayTotal(
  dailyPricesByDate: Record<string, CalendarDayPricingDto>,
  checkIn: string,
  checkOut: string,
): number {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;

  let total = 0;
  let cursor = checkIn;

  while (cursor < checkOut) {
    total += resolveNightRate(dailyPricesByDate[cursor]);
    const [y, m, d] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cursor = next.toISOString().slice(0, 10);
  }

  return Math.round(total);
}

/** Total con presupuesto: noches PriceLabs + tarifa de aseo de la propiedad. */
export function sumBudgetReservationTotal(
  dailyPricesByDate: Record<string, CalendarDayPricingDto>,
  checkIn: string,
  checkOut: string,
  cleaningFee?: number | null,
): number {
  const nights = sumPriceLabsStayTotal(dailyPricesByDate, checkIn, checkOut);
  const fee =
    cleaningFee != null && cleaningFee > 0 ? Math.round(cleaningFee) : 0;
  return nights + fee;
}
