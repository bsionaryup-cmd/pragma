"use client";

import { formatMoney } from "@/lib/format-currency";

export type FinanceComparisonPoint = {
  label: string;
  revenue: number;
  expenses: number;
};

type DashboardFinanceBarChartProps = {
  points: FinanceComparisonPoint[];
};

export function DashboardFinanceBarChart({ points }: DashboardFinanceBarChartProps) {
  const max = Math.max(...points.flatMap((point) => [point.revenue, point.expenses]), 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-pragma-electric" aria-hidden />
          Ingresos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-pragma-mid-gray" aria-hidden />
          Egresos
        </span>
      </div>
      <div className="flex items-end justify-center gap-8 sm:gap-12">
        {points.map((point) => (
          <div key={point.label} className="flex flex-col items-center gap-2">
            <div className="flex h-36 items-end gap-2">
              <div
                className="w-9 rounded-t-md bg-pragma-electric sm:w-10"
                style={{
                  height: `${Math.max(8, (point.revenue / max) * 100)}%`,
                }}
                title={formatMoney(point.revenue)}
              />
              <div
                className="w-9 rounded-t-md bg-pragma-mid-gray sm:w-10"
                style={{
                  height: `${Math.max(8, (point.expenses / max) * 100)}%`,
                }}
                title={formatMoney(point.expenses)}
              />
            </div>
            <span className="text-xs font-medium text-foreground">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
