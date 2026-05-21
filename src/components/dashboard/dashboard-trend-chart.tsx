"use client";

import { cn } from "@/lib/utils";

export type TrendBar = {
  label: string;
  value: number;
  formatted: string;
};

type DashboardTrendChartProps = {
  title: string;
  bars: TrendBar[];
  accentClass?: string;
};

export function DashboardTrendChart({
  title,
  bars,
  accentClass = "bg-pragma-electric",
}: DashboardTrendChartProps) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-4 flex h-36 items-end gap-2">
        {bars.map((bar) => (
          <div
            key={bar.label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <span className="text-[10px] font-medium text-muted-foreground">
              {bar.formatted}
            </span>
            <div
              className={cn(
                "w-full max-w-[48px] rounded-t-md transition-all",
                accentClass,
              )}
              style={{ height: `${Math.max(8, (bar.value / max) * 100)}%` }}
              title={bar.formatted}
            />
            <span className="truncate text-[10px] text-muted-foreground">
              {bar.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
