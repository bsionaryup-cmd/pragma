import { DEFAULT_CURRENCY } from "@/lib/constants";
import type { Locale } from "@/i18n/types";

export function formatMoney(
  amount: number,
  currency = DEFAULT_CURRENCY,
  locale: Locale = "es",
): string {
  const intlLocale = locale === "es" ? "es-CO" : "en-US";
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, Math.round(value));
}
