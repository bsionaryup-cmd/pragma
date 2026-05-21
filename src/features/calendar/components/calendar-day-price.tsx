"use client";

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

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col items-center gap-0 px-0.5 pb-0.5",
        pricing.isBooked && "opacity-60",
      )}
    >
      <span
        className={cn(
          "max-w-full truncate text-[9px] font-semibold leading-none tabular-nums",
          pricing.isBooked ? "text-muted-foreground" : "text-[#5eead4]",
        )}
      >
        {formatCompactPrice(display)}
      </span>
      {pricing.minStay != null && pricing.minStay > 1 ? (
        <span className="text-[8px] leading-none text-muted-foreground">
          {pricing.minStay}n
        </span>
      ) : null}
      {demandStyle ? (
        <span
          className="mt-0.5 h-1 w-1 rounded-full"
          style={demandStyle}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
