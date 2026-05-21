"use client";

import { Receipt, TrendingUp, Wallet } from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { useI18n } from "@/components/providers/i18n-provider";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPanelDate } from "@/lib/helpers/date";
import { ManualFinanceForms } from "@/components/finance/manual-finance-forms";
import type { FinanceOverview } from "@/services/finance/finance.service";

type FinanceViewProps = {
  data: FinanceOverview;
  canWrite?: boolean;
};

function ComparisonRow({
  label,
  current,
  previous,
  trend,
}: {
  label: string;
  current: string;
  previous: string;
  trend: number;
}) {
  const trendSign = trend > 0 ? "+" : "";
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-pragma-light-blue/20 px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="text-end">
        <p className="text-sm font-semibold text-foreground">{current}</p>
        <p className="text-xs text-muted-foreground">
          {previous} · {trendSign}
          {trend}%
        </p>
      </div>
    </div>
  );
}

export function FinanceView({ data, canWrite = false }: FinanceViewProps) {
  const { t } = useI18n();
  const { kpis, comparison, profitability, topProperties } = data;

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={t("finance.eyebrow")}
          title={t("finance.title")}
          description={t("finance.description")}
        />

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label={t("finance.kpi.revenue")}
            value={kpis.revenueFormatted}
            icon={TrendingUp}
          />
          <KpiCard
            label={t("finance.kpi.expenses")}
            value={kpis.expensesFormatted}
            icon={Receipt}
          />
          <KpiCard
            label={t("finance.kpi.netProfit")}
            value={kpis.netProfitFormatted}
            icon={Wallet}
          />
        </section>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <SectionCard title={t("finance.comparison.title")}>
            <div className="space-y-3 p-4 sm:p-6">
              <ComparisonRow
                label={t("finance.comparison.revenue")}
                current={kpis.revenueFormatted}
                previous={String(comparison.revenue.previous)}
                trend={comparison.revenue.trend}
              />
              <ComparisonRow
                label={t("finance.comparison.expenses")}
                current={kpis.expensesFormatted}
                previous={String(comparison.expenses.previous)}
                trend={comparison.expenses.trend}
              />
              <ComparisonRow
                label={t("finance.comparison.profit")}
                current={kpis.netProfitFormatted}
                previous={String(comparison.profit.previous)}
                trend={comparison.profit.trend}
              />
              <ComparisonRow
                label={t("finance.comparison.reservations")}
                current={String(comparison.reservations.current)}
                previous={String(comparison.reservations.previous)}
                trend={comparison.reservations.trend}
              />
            </div>
          </SectionCard>

          <SectionCard
            title={t("finance.forecast.title")}
            description={t("finance.forecast.description")}
          >
            <div className="p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("finance.forecast.projected")}
              </p>
              <p className="font-heading mt-2 text-3xl font-semibold text-pragma-electric">
                {data.revenueForecastFormatted}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("finance.profitability.margin")}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{profitability.margin}%</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("finance.profitability.roi")}
                  </p>
                  <p className="mt-1 text-xl font-semibold">{profitability.roi}%</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("finance.profitability.avgProperty")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {profitability.avgPerProperty.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("finance.profitability.avgReservation")}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {profitability.avgPerReservation.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <SectionCard title={t("finance.flows.revenue")}>
            <div className="pragma-scrollbar overflow-x-auto px-4 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase">{t("finance.flows.source")}</TableHead>
                    <TableHead className="text-xs uppercase">{t("finance.flows.property")}</TableHead>
                    <TableHead className="text-xs uppercase">{t("finance.flows.date")}</TableHead>
                    <TableHead className="text-end text-xs uppercase">{t("finance.flows.amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.revenueFlow.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        {t("finance.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.revenueFlow.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.source}</TableCell>
                        <TableCell>{row.propertyName}</TableCell>
                        <TableCell>{formatPanelDate(row.date)}</TableCell>
                        <TableCell className="text-end font-semibold">{row.amountFormatted}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title={t("finance.flows.expenses")}>
            <div className="pragma-scrollbar overflow-x-auto px-4 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase">{t("finance.flows.category")}</TableHead>
                    <TableHead className="text-xs uppercase">{t("finance.flows.property")}</TableHead>
                    <TableHead className="text-xs uppercase">{t("finance.flows.date")}</TableHead>
                    <TableHead className="text-end text-xs uppercase">{t("finance.flows.amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expenseFlow.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        {t("finance.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.expenseFlow.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.propertyName}</TableCell>
                        <TableCell>{formatPanelDate(row.date)}</TableCell>
                        <TableCell className="text-end font-semibold">{row.amountFormatted}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </div>

        <SectionCard title={t("finance.topProperties.title")}>
          <div className="pragma-scrollbar overflow-x-auto px-4 sm:px-6 pb-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase">{t("finance.topProperties.property")}</TableHead>
                  <TableHead className="text-xs uppercase">{t("finance.topProperties.revenue")}</TableHead>
                  <TableHead className="text-xs uppercase">{t("finance.topProperties.occupancy")}</TableHead>
                  <TableHead className="text-end text-xs uppercase">{t("finance.topProperties.reservations")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProperties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {t("finance.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  topProperties.map((row) => (
                    <TableRow key={row.propertyId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.revenueFormatted}</TableCell>
                      <TableCell>{row.occupancy}%</TableCell>
                      <TableCell className="text-end">{row.reservations}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {canWrite ? (
          <div className="mt-8">
            <ManualFinanceForms />
          </div>
        ) : null}
      </div>
    </ModuleShellFlow>
  );
}
