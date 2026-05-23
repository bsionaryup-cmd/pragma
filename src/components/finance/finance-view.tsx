"use client";

import { useState } from "react";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
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
  Table,
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

type FinanceViewProps = {
  data: FinanceOverview;
  canWrite?: boolean;
  scope?: "full" | "operations";
};

type FinanceTab = "overview" | "revenue" | "expenses" | "otherIncome";

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
  if (manualAmount <= 0) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
      {reservationLabel}: {reservationAmount.toLocaleString()} · {manualLabel}:{" "}
      {manualAmount.toLocaleString()}
    </p>
  );
}

export function FinanceView({
  data,
  canWrite = false,
  scope = "full",
}: FinanceViewProps) {
  const { t, locale } = useI18n();
  const { kpis, comparison, profitability } = data;
  const formatAmount = (amount: number) => formatMoney(amount, undefined, locale);
  const isOperations = scope === "operations";
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");

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
            title="Finanzas operativas"
            description="Consulta gastos y otros ingresos registrados."
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
            <ExpenseFlowTable data={data} />
            <OtherIncomeFlowTable rows={otherIncomeFlow} />
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
        />

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <KpiCard
              label={t("finance.kpi.revenue")}
              value={kpis.revenueFormatted}
              icon={TrendingUp}
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
          />
          <KpiCard
            label={t("finance.kpi.pendingIncome")}
            value={kpis.pendingIncomeFormatted}
            icon={TrendingUp}
          />
        </section>

        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
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
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title={t("finance.comparison.title")}>
              <div className="space-y-3 p-4 sm:p-6">
                <ComparisonRow
                  label={t("finance.comparison.revenue")}
                  current={kpis.revenueFormatted}
                  previous={formatAmount(comparison.revenue.previous)}
                  trend={comparison.revenue.trend}
                />
                <ComparisonRow
                  label={t("finance.comparison.expenses")}
                  current={kpis.expensesFormatted}
                  previous={formatAmount(comparison.expenses.previous)}
                  trend={comparison.expenses.trend}
                />
                <ComparisonRow
                  label={t("finance.comparison.profit")}
                  current={kpis.netProfitFormatted}
                  previous={formatAmount(comparison.profit.previous)}
                  trend={comparison.profit.trend}
                />
              </div>
            </SectionCard>

            <SectionCard
              title={t("finance.forecast.title")}
              description={t("finance.forecast.description")}
            >
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("finance.forecast.projected")}
                  </p>
                  <p className="font-heading mt-2 text-3xl font-semibold text-pragma-electric">
                    {data.revenueForecastFormatted}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("finance.profitability.margin")}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{profitability.margin}%</p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("finance.profitability.avgProperty")}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {profitability.avgPerProperty.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "revenue" ? (
          <SectionCard title={t("finance.flows.revenue")}>
            <FinanceTable>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase">{t("finance.flows.source")}</TableHead>
                  <TableHead className="text-xs uppercase">Huésped</TableHead>
                  <TableHead className="text-xs uppercase">{t("finance.flows.property")}</TableHead>
                  <TableHead className="text-xs uppercase">{t("finance.flows.date")}</TableHead>
                  <TableHead className="text-end text-xs uppercase">{t("finance.flows.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservationFlow.length === 0 ? (
                  <EmptyRow colSpan={5} message={t("finance.empty")} />
                ) : (
                  reservationFlow.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.source}</TableCell>
                      <TableCell>{row.guestName ?? "—"}</TableCell>
                      <TableCell>{row.propertyName}</TableCell>
                      <TableCell>{formatPanelDate(row.date)}</TableCell>
                      <TableCell className="text-end font-semibold">{row.amountFormatted}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </FinanceTable>
          </SectionCard>
        ) : null}

        {activeTab === "expenses" ? (
          <div className="space-y-6">
            <ExpenseFlowTable data={data} />
            {canWrite ? <ExpenseSubmodule /> : null}
          </div>
        ) : null}

        {activeTab === "otherIncome" ? (
          <div className="space-y-6">
            <OtherIncomeFlowTable rows={otherIncomeFlow} />
            {canWrite ? <OtherIncomeSubmodule /> : null}
          </div>
        ) : null}
      </div>
    </ModuleShellFlow>
  );
}

function ExpenseFlowTable({ data }: { data: FinanceOverview }) {
  const { t } = useI18n();
  return (
    <SectionCard title={t("finance.flows.expenses")}>
      <FinanceTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase">{t("finance.flows.category")}</TableHead>
            <TableHead className="text-xs uppercase">{t("finance.flows.property")}</TableHead>
            <TableHead className="text-xs uppercase">{t("finance.flows.date")}</TableHead>
            <TableHead className="text-xs uppercase">Detalle</TableHead>
            <TableHead className="text-end text-xs uppercase">{t("finance.flows.amount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.expenseFlow.length === 0 ? (
            <EmptyRow colSpan={5} message={t("finance.empty")} />
          ) : (
            data.expenseFlow.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.propertyName}</TableCell>
                <TableCell>{formatPanelDate(row.date)}</TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">
                  {row.detail ?? "—"}
                </TableCell>
                <TableCell className="text-end font-semibold">{row.amountFormatted}</TableCell>
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
}: {
  rows: FinanceOverview["revenueFlow"];
}) {
  const { t } = useI18n();
  return (
    <SectionCard title={t("finance.kpi.otherIncome")}>
      <FinanceTable>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase">{t("finance.manual.description")}</TableHead>
            <TableHead className="text-xs uppercase">{t("finance.flows.date")}</TableHead>
            <TableHead className="text-end text-xs uppercase">{t("finance.flows.amount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={3} message={t("finance.empty")} />
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.source}</TableCell>
                <TableCell>{formatPanelDate(row.date)}</TableCell>
                <TableCell className="text-end font-semibold">{row.amountFormatted}</TableCell>
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
    <div className="pragma-scrollbar overflow-x-auto px-4 sm:px-6">
      <Table>{children}</Table>
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
