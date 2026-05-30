"use client";

import { memo, useMemo, useState } from "react";
import { formatMoney } from "@/lib/format-currency";
import type { FinanceYearMonthPoint } from "@/services/finance/finance-yearly-series";
import { cn } from "@/lib/utils";

type FinanceYearlyOverviewChartProps = {
  months: FinanceYearMonthPoint[];
  year: number;
  locale?: "es" | "en";
  selectedMonthIndex?: number;
};

type TooltipState = {
  monthIndex: number;
  x: number;
  y: number;
} | null;

function FinanceYearlyOverviewChartInner({
  months,
  year,
  locale = "es",
  selectedMonthIndex,
}: FinanceYearlyOverviewChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const maxValue = useMemo(
    () => Math.max(...months.flatMap((m) => [m.revenue, m.expenses]), 1),
    [months],
  );

  const activeMonth = tooltip
    ? months.find((m) => m.monthIndex === tooltip.monthIndex)
    : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-pragma-electric" aria-hidden />
          Ingresos confirmados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-slate-400/80" aria-hidden />
          Egresos registrados
        </span>
      </div>

      <div
        className="relative grid grid-cols-12 items-end gap-1 sm:gap-2"
        onMouseLeave={() => setTooltip(null)}
      >
        {months.map((month) => {
          const revenueHeight = month.isFuture
            ? 4
            : Math.max(6, (month.revenue / maxValue) * 100);
          const expenseHeight = month.isFuture
            ? 4
            : Math.max(6, (month.expenses / maxValue) * 100);

          const isSelected = selectedMonthIndex === month.monthIndex;

          return (
            <div
              key={month.monthIndex}
              className={cn(
                "group flex min-w-0 flex-col items-center gap-1",
                isSelected && "rounded-lg bg-pragma-electric/5 px-0.5",
              )}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  monthIndex: month.monthIndex,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
            >
              <div className="flex h-28 w-full items-end justify-center gap-0.5 sm:h-32 sm:gap-1">
                <div
                  className={cn(
                    "w-[42%] max-w-[14px] rounded-t-md transition-all duration-200 sm:max-w-[18px]",
                    month.isFuture
                      ? "bg-pragma-electric/15"
                      : "bg-pragma-electric group-hover:bg-pragma-cyan",
                  )}
                  style={{ height: `${revenueHeight}%` }}
                />
                <div
                  className={cn(
                    "w-[42%] max-w-[14px] rounded-t-md transition-all duration-200 sm:max-w-[18px]",
                    month.isFuture
                      ? "bg-slate-300/40"
                      : "bg-slate-400/70 group-hover:bg-slate-500/80",
                  )}
                  style={{ height: `${expenseHeight}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium sm:text-xs",
                  month.isFuture
                    ? "text-muted-foreground/60"
                    : "text-foreground",
                )}
              >
                {month.label}
              </span>
            </div>
          );
        })}
      </div>

      {activeMonth && tooltip ? (
        <div
          className="pointer-events-none fixed z-50 min-w-[200px] -translate-x-1/2 -translate-y-full rounded-xl border border-border/80 bg-card/95 px-3 py-2.5 shadow-pragma-card backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
          role="tooltip"
        >
          <p className="text-xs font-semibold text-foreground">
            {activeMonth.label} {year}
          </p>
          {activeMonth.isFuture ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sin datos proyectados
            </p>
          ) : (
            <dl className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>Ingresos</dt>
                <dd className="font-medium text-pragma-electric">
                  {formatMoney(activeMonth.revenue, undefined, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Egresos</dt>
                <dd className="font-medium text-foreground">
                  {formatMoney(activeMonth.expenses, undefined, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Ocupación</dt>
                <dd className="font-medium text-foreground">
                  {activeMonth.occupancy}%
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Pagos confirmados</dt>
                <dd className="font-medium text-foreground">
                  {activeMonth.paidReservations}
                </dd>
              </div>
              {activeMonth.cancellations > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>Cancelaciones</dt>
                  <dd className="font-medium text-amber-700">
                    {activeMonth.cancellations}
                  </dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      ) : null}
    </div>
  );
}

export const FinanceYearlyOverviewChart = memo(FinanceYearlyOverviewChartInner);
