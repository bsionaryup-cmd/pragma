"use client";

import { Users } from "lucide-react";
import { formatCompactPrice } from "@/features/calendar/lib/daily-pricing";
import type { CalendarDayPricingDto } from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

type CalendarDayPriceProps = {
  pricing: CalendarDayPricingDto | undefined;
};

export function CalendarDayPrice({ pricing }: CalendarDayPriceProps) {
  if (!pricing) return null;

  const display =
    pricing.recommendedPrice ?? pricing.nightlyPrice ?? pricing.basePrice;
  if (display == null) return null;

  const demandStyle =
    pricing.demandColor && /^#[0-9A-Fa-f]{3,8}$/.test(pricing.demandColor)
      ? { backgroundColor: pricing.demandColor }
      : undefined;

  const minStay = pricing.minStay != null && pricing.minStay > 0 ? pricing.minStay : null;

  return (
    <>
      {minStay != null ? (
        <div
          className={cn(
            "pointer-events-none absolute top-1 right-1 z-[2] flex items-center gap-0.5 text-[11px] font-medium tabular-nums text-[var(--cal-text-secondary)]",
            pricing.isBooked && "opacity-60",
          )}
        >
          <Users className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <span>{minStay}</span>
        </div>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute right-1 bottom-1 z-[2] text-right",
          pricing.isBooked && "opacity-55",
        )}
      >
        <span className="text-xs font-medium tabular-nums text-[var(--cal-text-secondary)]">
          {formatCompactPrice(display)}
        </span>
        {demandStyle ? (
          <span
            className="mt-0.5 ml-auto block h-1 w-1 rounded-full"
            style={demandStyle}
            aria-hidden
          />
        ) : null}
      </div>
    </>
  );
}
