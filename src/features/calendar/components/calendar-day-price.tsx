"use client";

import { Users } from "lucide-react";
import type { CalendarDayPricingDto } from "@/features/calendar/types/calendar.types";
import { cn } from "@/lib/utils";

type CalendarDayPriceProps = {
  pricing: CalendarDayPricingDto | undefined;
  highlighted?: boolean;
  occupied?: boolean;
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
  occupied = false,
  showPrice = false,
  showMinimumStay = false,
}: CalendarDayPriceProps) {
  if (!pricing || (!showPrice && !showMinimumStay)) return null;

  const display =
    pricing.recommendedPrice ?? pricing.nightlyPrice ?? pricing.basePrice;
  const minStay =
    pricing.minStay != null && pricing.minStay > 0 ? pricing.minStay : null;

  const showMinStayLabel = showMinimumStay && minStay != null;
  const showPriceLabel = showPrice && display != null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {showMinStayLabel || showPriceLabel ? (
        <div className="absolute right-1.5 bottom-1.5 flex flex-col items-end gap-0.5 text-right">
          {showMinStayLabel ? (
            <div
              className={cn(
                "flex items-center gap-0.5 text-[10px] font-normal tabular-nums leading-none",
                highlighted
                  ? "text-[var(--cal-text-range-select)]"
                  : occupied
                    ? "text-[var(--cal-text-occupied)] opacity-80"
                    : "text-[var(--cal-text-muted)]",
                !highlighted && !occupied && pricing.isBooked && "opacity-60",
              )}
            >
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              <span>{minStay}</span>
            </div>
          ) : null}
          {showPriceLabel ? (
            <div
              className={cn(
                !highlighted && !occupied && pricing.isBooked && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "text-[12px] font-semibold tabular-nums leading-none",
                  highlighted
                    ? "text-[var(--cal-text-range-select)]"
                    : occupied
                      ? "text-[var(--cal-text-occupied)] opacity-90"
                      : "text-[var(--cal-text-day)]",
                )}
              >
                {formatLodgifyPrice(display)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
