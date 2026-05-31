"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import type { FinanceOverview } from "@/services/finance/finance.service";
import { cn } from "@/lib/utils";

type FinanceMonthlyOccupancySummaryCardProps = {
  data: FinanceOverview;
};

function trendLabelFromPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export function FinanceMonthlyOccupancySummaryCard({
  data,
}: FinanceMonthlyOccupancySummaryCardProps) {
  const { t } = useI18n();
  const { kpis, comparison, selectedMonthLabel, monthlyOccupancy } = data;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-pragma-electric/20 bg-gradient-to-br from-pragma-electric/5 to-transparent p-5 shadow-pragma-soft">
      <p className="text-sm font-semibold text-foreground">{selectedMonthLabel}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("finance.kpi.revenue")}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {kpis.revenueFormatted}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("finance.comparison.occupancy")}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {monthlyOccupancy.occupancyPct}%
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("finance.forecast.projected")}
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {monthlyOccupancy.projectedRevenueFormatted}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("finance.monthlyOccupancy.vsPreviousMonth")}
          </dt>
          <dd
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums",
              comparison.revenue.trend > 0
                ? "text-emerald-600"
                : comparison.revenue.trend < 0
                  ? "text-rose-600"
                  : "text-foreground",
            )}
          >
            {trendLabelFromPct(comparison.revenue.trend)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
