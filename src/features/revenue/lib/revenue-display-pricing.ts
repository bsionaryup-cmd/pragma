import type { PriceLabsPropertyInsights } from "@/integrations/pricelabs/insights";
import type { RevenuePropertyRow } from "@/features/revenue/lib/revenue-property-anomaly";

export type RevenueDisplayPrice = {
  recommended: number | null;
  delta: number | null;
  /** Precio de referencia PriceLabs para calcular la diferencia */
  referenceBase: number | null;
  source: "daily_calendar" | "stored_snapshot";
  pricingReason: string | null;
  dateLabel: string | null;
};

function parseStoredNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Tarifa y diferencia visibles: prioriza el calendario diario de PriceLabs (hoy). */
export function resolveRevenueDisplayPrice(
  property: RevenuePropertyRow,
): RevenueDisplayPrice {
  const { insights } = property;
  const today = insights.next14Days[0];

  if (insights.hasDailyPrices && today?.recommended != null) {
    const delta =
      today.recommended != null && today.base != null
        ? today.recommended - today.base
        : null;
    return {
      recommended: today.recommended,
      delta,
      referenceBase: today.base,
      source: "daily_calendar",
      pricingReason: today.pricingReason,
      dateLabel: "Hoy",
    };
  }

  return {
    recommended: parseStoredNumber(property.recommendedRate),
    delta: parseStoredNumber(property.priceDelta),
    referenceBase: null,
    source: "stored_snapshot",
    pricingReason: insights.pricingReasonSample,
    dateLabel: null,
  };
}

export function resolvePropertyDeltaForSort(property: RevenuePropertyRow): number | null {
  const display = resolveRevenueDisplayPrice(property);
  if (display.delta != null) return display.delta;
  return parseStoredNumber(property.priceDelta);
}

export function formatMinStayLabel(minStay: number | null | undefined): string | null {
  if (minStay == null || minStay < 1) return null;
  if (minStay === 1) return "1 noche";
  return `${minStay} noches`;
}

export type CalendarDayPreview = PriceLabsPropertyInsights["next14Days"][number];
