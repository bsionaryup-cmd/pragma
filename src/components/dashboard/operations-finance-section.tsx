"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { DashboardFinanceBarChart } from "@/components/dashboard/dashboard-finance-bar-chart";
import { useI18n } from "@/components/providers/i18n-provider";
import type { CommandCenterTrendPoint } from "@/services/dashboard/command-center.service";
import type { OperationsFinanceSummary } from "@/services/dashboard/operations-center.types";
import { cn } from "@/lib/utils";

type OperationsFinanceSectionProps = {
  finance: OperationsFinanceSummary;
  trendPoints: CommandCenterTrendPoint[];
};

function TrendBadge({ trend, t }: { trend: number; t: ReturnType<typeof useI18n>["t"] }) {
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-pragma-olive-leaf/15 px-2 py-0.5 text-xs font-medium text-pragma-olive-leaf">
        <ArrowUpRight className="h-3 w-3" />
        {t("common.trendUp")} {Math.abs(trend)}%
      </span>
    );
  }
  if (trend < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <ArrowDownRight className="h-3 w-3" />
        {t("common.trendDown")} {Math.abs(trend)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <ArrowRight className="h-3 w-3" />
      {t("common.trendFlat")}
    </span>
  );
}

export function OperationsFinanceSection({
  finance,
  trendPoints,
}: OperationsFinanceSectionProps) {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-pragma-soft">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pragma-olive-leaf/35 to-transparent"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {t("dashboard.kpi.monthlyRevenue")}
        </h2>
        <Link
          href="/finance"
          className="shrink-0 text-xs font-medium text-pragma-electric transition-colors hover:underline"
        >
          {t("nav.finance")}
        </Link>
      </div>

      <div className="space-y-5 px-5 pb-5 pt-4 sm:px-6">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {finance.revenueFormatted}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TrendBadge trend={finance.revenueTrend} t={t} />
            <span className="text-xs text-muted-foreground">{t("common.vsPreviousMonth")}</span>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border border-border/60 bg-muted/10 p-3",
            "[&_.flex.h-36]:h-24",
          )}
        >
          <DashboardFinanceBarChart
            points={trendPoints.map((point) => ({
              label: point.label,
              revenue: point.revenue,
              expenses: point.expenses,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
