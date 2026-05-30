"use client";

import Link from "next/link";
import { useState } from "react";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
import { FinanceYearlyOverviewChart } from "@/components/finance/finance-yearly-overview-chart";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  ExpenseSubmodule,
  OtherIncomeSubmodule,
} from "@/components/finance/manual-finance-forms";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format-currency";
import { formatPanelDate } from "@/lib/helpers/date";
import type { FinanceOverview } from "@/services/finance/finance.service";
import { cn } from "@/lib/utils";
import { ManualFinanceRowActions } from "@/components/finance/manual-finance-row-actions";

type FinanceViewProps = {
  data: FinanceOverview;
  canWrite?: boolean;
  scope?: "full" | "operations";
};

type FinanceTab = "overview" | "revenue" | "expenses" | "otherIncome";

function trendFromPct(pct: number): "up" | "down" | "flat" {
  if (pct > 0) return "up";
  if (pct < 0) return "down";
  return "flat";
}

function trendLabelFromPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs mes anterior`;
}

function KpiBreakdown({
  reservationAmount,
  manualAmount,
  reservationLabel,
  manualLabel,
}: {
  reservationAmount: number;
  manualAmount: number;
  reservationLabel: string;
  manualLabel: string;
}) {
  if (manualAmount <= 0 && reservationAmount <= 0) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
      {reservationLabel}: {reservationAmount.toLocaleString()}
      {manualAmount > 0 ? (
        <>
          {" "}
          · {manualLabel}: {manualAmount.toLocaleString()}
        </>
      ) : null}
    </p>
  );
}

export function FinanceView({
  data,
  canWrite = false,
  scope = "full",
}: FinanceViewProps) {
  const { t, locale } = useI18n();
  const { kpis, comparison, profitability, selectedMonth, selectedMonthLabel } =
    data;
  const formatAmount = (amount: number) => formatMoney(amount, undefined, locale);
  const isOperations = scope === "operations";
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const selectedMonthIndex = Number(selectedMonth.split("-")[1]) - 1;

  const otherIncomeFlow = data.revenueFlow.filter(
    (row) => row.propertyName === "Otros ingresos",
  );
  const reservationFlow = data.revenueFlow.filter(
    (row) => row.propertyName !== "Otros ingresos",
  );

  const tabs: { id: FinanceTab; label: string }[] = [
    { id: "overview", label: t("finance.tabs.overview") },
    { id: "revenue", label: t("finance.tabs.revenue") },
    { id: "expenses", label: t("finance.tabs.expenses") },
    { id: "otherIncome", label: t("finance.tabs.otherIncome") },
  ];

  if (isOperations) {
    return (
      <ModuleShellFlow className="bg-background">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
          <PageHeader
            eyebrow={t("finance.eyebrow")}
            title={t("finance.operationsTitle")}
            description={t("finance.operationsDescription")}
          />

          <section className="mb-6 grid gap-3 sm:grid-cols-2">
            <KpiCard
              label={t("finance.kpi.expenses")}
              value={kpis.expensesFormatted}
              icon={Receipt}
            />
            <KpiCard
              label={t("finance.kpi.otherIncome")}
              value={formatAmount(kpis.manualIncomeTotal)}
              icon={TrendingUp}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <ExpenseFlowTable data={data} canWrite={canWrite} />
            <OtherIncomeFlowTable rows={otherIncomeFlow} canWrite={canWrite} />
          </div>
        </div>
      </ModuleShellFlow>
    );
  }

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={t("finance.eyebrow")}
          title={t("finance.title")}
          description={t("finance.description")}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/finance/payment-history"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
              >
                {t("finance.links.history")}
              </Link>
              <Link
                href="/finance/payment-links"
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                {t("finance.links.chargeLinks")}
              </Link>
            </div>
          }
        />

        <section className="mb-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("finance.period")} · {selectedMonthLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("finance.ytd", { year: data.chartYear })}: {data.yearToDateRevenueFormatted}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-12">
            {data.yearlyChart.map((monthPoint) => {
              const monthKey = `${data.chartYear}-${String(monthPoint.monthIndex + 1).padStart(2, "0")}`;
              const isSelected = selectedMonth === monthKey;
              const className = cn(
                "rounded-md border px-1.5 py-1 text-center text-xs font-medium transition-colors sm:px-2",
                monthPoint.isFuture
                  ? "border-border/50 text-muted-foreground/40"
                  : isSelected
                    ? "border-pragma-electric bg-pragma-electric/10 text-pragma-electric"
                    : "border-border bg-card text-foreground hover:bg-muted/40",
              );

              const isFutureWithoutData =
                monthPoint.isFuture &&
                monthPoint.pendingRevenue <= 0 &&
                monthPoint.revenue <= 0;

              if (isFutureWithoutData) {
                return (
                  <span key={monthKey} className={className} aria-disabled>
                    {monthPoint.label}
                  </span>
                );
              }

              return (
                <Link
                  key={monthKey}
                  href={`/finance?month=${monthKey}`}
                  aria-current={isSelected ? "page" : undefined}
                  className={className}
                >
                  {monthPoint.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <KpiCard
              label={t("finance.kpi.revenue")}
              value={kpis.revenueFormatted}
              icon={TrendingUp}
              trend={trendFromPct(comparison.revenue.trend)}
              trendLabel={trendLabelFromPct(comparison.revenue.trend)}
              className="p-3.5"
            />
            <KpiBreakdown
              reservationAmount={kpis.reservationRevenue}
              manualAmount={kpis.manualIncomeTotal}
              reservationLabel={t("finance.kpi.reservations")}
              manualLabel={t("finance.kpi.otherIncome")}
            />
          </div>
          <div>
            <KpiCard
              label={t("finance.kpi.expenses")}
              value={kpis.expensesFormatted}
              icon={Receipt}
              trend={trendFromPct(comparison.expenses.trend)}
              trendLabel={trendLabelFromPct(comparison.expenses.trend)}
              className="p-3.5"
            />
            <KpiBreakdown
              reservationAmount={kpis.reservationExpenses}
              manualAmount={kpis.manualExpenseTotal}
              reservationLabel={t("finance.kpi.cleaning")}
              manualLabel={t("finance.kpi.otherExpenses")}
            />
          </div>
          <KpiCard
            label={t("finance.kpi.netProfit")}
            value={kpis.netProfitFormatted}
            icon={Wallet}
            trend={trendFromPct(comparison.profit.trend)}
            trendLabel={trendLabelFromPct(comparison.profit.trend)}
            className="p-3.5"
          />
          <KpiCard
            label={t("finance.kpi.pendingIncome")}
            value={kpis.pendingIncomeFormatted}
            icon={TrendingUp}
            className="p-3.5"
          />
        </section>

        <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px [-webkit-overflow-scrolling:touch]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 px-3 py-2 text-sm font-semibold transition-colors sm:px-4",
                activeTab === tab.id
                  ? "border-b-2 border-pragma-electric text-pragma-electric"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" ? (
          <div className="space-y-5">
            <SectionCard
              title={t("finance.annualSummaryTitle", { year: data.chartYear })}
              description={t("finance.annualSummaryDescription")}
            >
              <div className="p-4 sm:p-5">
                <FinanceYearlyOverviewChart
                  months={data.yearlyChart}
                  year={data.chartYear}
                  locale={locale}
                  selectedMonthIndex={selectedMonthIndex}
                />
              </div>
            </SectionCard>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {t("finance.profitability.margin")} · {selectedMonthLabel}
                </p>
                <p className="mt-1 text-lg font-semibold">{profitability.margin}%</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {t("finance.profitability.avgProperty")}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {profitability.avgPerProperty.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {t("finance.ytdRevenue", { year: data.chartYear })}
                </p>
                <p className="mt-1 text-lg font-semibold text-pragma-electric">
                  {data.yearToDateRevenueFormatted}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "revenue" ? (
          <SectionCard title={t("finance.flows.revenue")}>
            <FinanceTable>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[46%] text-xs uppercase">
                    Reserva
                  </TableHead>
                  <TableHead className="w-[24%] text-xs uppercase">
                    {t("finance.flows.date")}
                  </TableHead>
                  <TableHead className="w-[30%] text-end text-xs uppercase">
                    {t("finance.flows.amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservationFlow.length === 0 ? (
                  <EmptyRow colSpan={3} message={t("finance.empty")} />
                ) : (
                  reservationFlow.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="truncate font-medium">
                          {row.guestName ?? row.source}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.propertyName}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPanelDate(row.date)}
                      </TableCell>
                      <TableCell className="text-end text-sm font-semibold tabular-nums">
                        {row.amountFormatted}
                        {row.status === "pending" ? (
                          <span className="ml-1.5 text-[10px] font-medium text-amber-700">
                            Pendiente
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </FinanceTable>
          </SectionCard>
        ) : null}

        {activeTab === "expenses" ? (
          <div className="space-y-5">
            <ExpenseFlowTable data={data} canWrite={canWrite} />
            {canWrite ? <ExpenseSubmodule /> : null}
          </div>
        ) : null}

        {activeTab === "otherIncome" ? (
          <div className="space-y-5">
            <OtherIncomeFlowTable rows={otherIncomeFlow} canWrite={canWrite} />
            {canWrite ? <OtherIncomeSubmodule /> : null}
          </div>
        ) : null}
      </div>
    </ModuleShellFlow>
  );
}

function ExpenseFlowTable({
  data,
  canWrite = false,
}: {
  data: FinanceOverview;
  canWrite?: boolean;
}) {
  const { t } = useI18n();
  const colSpan = canWrite ? 4 : 3;
  return (
    <SectionCard title={t("finance.flows.expenses")}>
      <FinanceTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%] text-xs uppercase">
              {t("finance.flows.category")}
            </TableHead>
            <TableHead className="w-[22%] text-xs uppercase">
              {t("finance.flows.date")}
            </TableHead>
            <TableHead className="w-[22%] text-end text-xs uppercase">
              {t("finance.flows.amount")}
            </TableHead>
            {canWrite ? (
              <TableHead className="w-[16%] text-end text-xs uppercase">Acciones</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.expenseFlow.length === 0 ? (
            <EmptyRow colSpan={colSpan} message={t("finance.empty")} />
          ) : (
            data.expenseFlow.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="truncate font-medium">{row.category}</p>
                  {row.detail ? (
                    <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatPanelDate(row.date)}
                </TableCell>
                <TableCell className="text-end text-sm font-semibold tabular-nums">
                  {row.amountFormatted}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    <ManualFinanceRowActions
                      kind="expense"
                      id={row.id}
                      amount={row.amount}
                      date={row.date}
                      label={row.category}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </FinanceTable>
    </SectionCard>
  );
}

function OtherIncomeFlowTable({
  rows,
  canWrite = false,
}: {
  rows: FinanceOverview["revenueFlow"];
  canWrite?: boolean;
}) {
  const { t } = useI18n();
  const colSpan = canWrite ? 4 : 3;
  return (
    <SectionCard title={t("finance.kpi.otherIncome")}>
      <FinanceTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[46%] text-xs uppercase">
              {t("finance.manual.description")}
            </TableHead>
            <TableHead className="w-[22%] text-xs uppercase">
              {t("finance.flows.date")}
            </TableHead>
            <TableHead className="w-[22%] text-end text-xs uppercase">
              {t("finance.flows.amount")}
            </TableHead>
            {canWrite ? (
              <TableHead className="w-[10%] text-end text-xs uppercase">Acciones</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colSpan} message={t("finance.empty")} />
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="truncate font-medium">{row.source}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatPanelDate(row.date)}
                </TableCell>
                <TableCell className="text-end text-sm font-semibold tabular-nums">
                  {row.amountFormatted}
                </TableCell>
                {canWrite ? (
                  <TableCell>
                    <ManualFinanceRowActions
                      kind="income"
                      id={row.id}
                      amount={row.amount}
                      date={row.date}
                      label={row.source}
                    />
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </FinanceTable>
    </SectionCard>
  );
}

function FinanceTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-4 sm:px-6">
      <table className="w-full table-fixed caption-bottom text-sm">{children}</table>
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}
