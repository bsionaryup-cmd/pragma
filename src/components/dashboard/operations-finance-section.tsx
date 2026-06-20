"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/i18n-provider";
import { SectionCard } from "@/components/ui/section-card";
import type { OperationsFinanceSummary } from "@/services/dashboard/operations-center.types";
import { cn } from "@/lib/utils";

type OperationsFinanceSectionProps = {
  finance: OperationsFinanceSummary;
};

function trendLabel(trend: number, t: ReturnType<typeof useI18n>["t"]) {
  if (trend > 0) return t("common.trendUp");
  if (trend < 0) return t("common.trendDown");
  return t("common.trendFlat");
}

export function OperationsFinanceSection({ finance }: OperationsFinanceSectionProps) {
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("dashboard.kpi.monthlyRevenue")}
      description={t("dashboard.financeSummaryDesc")}
      headerAction={
        <Link
          href="/finance"
          className="text-xs font-medium text-pragma-electric hover:underline"
        >
          {t("nav.finance")}
        </Link>
      }
    >
      <div className="space-y-5 px-4 pb-5 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("finance.kpi.netProfit")}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            {finance.netProfitFormatted}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {trendLabel(finance.netTrend, t)} · {t("common.vsPreviousMonth")}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t("finance.kpi.revenue")}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {finance.revenueFormatted}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("finance.kpi.pendingIncome")}</dt>
            <dd
              className={cn(
                "mt-1 text-sm font-semibold",
                finance.pendingIncomeFormatted !== "$ 0" &&
                  finance.pendingIncomeFormatted !== "0 COP"
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {finance.pendingIncomeFormatted}
            </dd>
          </div>
        </dl>
      </div>
    </SectionCard>
  );
}
