"use client";

import { Users } from "lucide-react";
import type { CalendarDayPricingDto } from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

type CalendarDayPriceProps = {
  pricing: CalendarDayPricingDto | undefined;
  highlighted?: boolean;
  showPrice?: boolean;
  showMinimumStay?: boolean;
};

function formatLodgifyPrice(value: number): string {
  return `${new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} $`;
}

export function CalendarDayPrice({
  pricing,
  highlighted = false,
  showPrice = false,
  showMinimumStay = false,
}: CalendarDayPriceProps) {
  if (!pricing || (!showPrice && !showMinimumStay)) return null;

  const display =
    pricing.recommendedPrice ?? pricing.nightlyPrice ?? pricing.basePrice;
  const minStay =
    pricing.minStay != null && pricing.minStay > 0 ? pricing.minStay : null;

  return (
    <>
      {showMinimumStay && minStay != null ? (
        <div
          className={cn(
            "pointer-events-none absolute top-1.5 right-1.5 z-[2] flex items-center gap-0.5 text-[10px] font-normal tabular-nums",
            highlighted
              ? "text-[var(--cal-text-range-select)]"
              : "text-[var(--cal-text-muted)]",
            !highlighted && pricing.isBooked && "opacity-60",
          )}
        >
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          <span>{minStay}</span>
        </div>
      ) : null}
      {showPrice && display != null ? (
        <div
          className={cn(
            "pointer-events-none absolute right-1.5 bottom-1.5 z-[2] text-right",
            !highlighted && pricing.isBooked && "opacity-55",
          )}
        >
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              highlighted
                ? "text-[var(--cal-text-range-select)]"
                : "text-[var(--cal-text-secondary)]",
            )}
          >
            {formatLodgifyPrice(display)}
          </span>
        </div>
      ) : null}
    </>
  );
}
