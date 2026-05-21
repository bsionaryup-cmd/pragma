"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BedDouble,
  Bell,
  CalendarCheck,
  CalendarX,
  KeyRound,
  Percent,
  Receipt,
  Sparkles,
  SprayCan,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { DashboardTrendChart } from "@/components/dashboard/dashboard-trend-chart";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { PanelReservationsTable } from "@/components/dashboard/panel-reservations-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPanelDate } from "@/lib/helpers/date";
import { formatMoney } from "@/lib/format-currency";
import type { CommandCenterData } from "@/services/dashboard/command-center.service";
import { cn } from "@/lib/utils";

type PanelTab = "arrivals" | "departures" | "current";

type CommandCenterViewProps = {
  firstName: string | null;
  data: CommandCenterData;
  showEmptyBanner: boolean;
  canCreateProperties: boolean;
};

function trendLabel(
  trend: number,
  t: ReturnType<typeof useI18n>["t"],
): { trend: "up" | "down" | "flat"; label: string } {
  if (trend > 0) {
    return {
      trend: "up",
      label: `${t("common.trendUp")} ${Math.abs(trend)}% · ${t("common.vsPreviousMonth")}`,
    };
  }
  if (trend < 0) {
    return {
      trend: "down",
      label: `${t("common.trendDown")} ${Math.abs(trend)}% · ${t("common.vsPreviousMonth")}`,
    };
  }
  return { trend: "flat", label: t("common.trendFlat") };
}

export function CommandCenterView({
  firstName,
  data,
  showEmptyBanner,
  canCreateProperties,
}: CommandCenterViewProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<PanelTab>("arrivals");
  const displayName = firstName?.trim() || t("common.team");
  const { kpis, operational, alerts, activity } = data;

  const occupancyTrend = trendLabel(kpis.occupancyTrend, t);
  const revenueTrend = trendLabel(kpis.revenueTrend, t);
  const expenseTrend = trendLabel(kpis.expenseTrend, t);
  const netTrend = trendLabel(kpis.netFlowTrend, t);

  const tabs: { id: PanelTab; labelKey: "checkIns" | "checkOuts" | "active"; countKey: keyof typeof data.counts }[] = [
    { id: "arrivals", labelKey: "checkIns", countKey: "arrivals" },
    { id: "departures", labelKey: "checkOuts", countKey: "departures" },
    { id: "current", labelKey: "active", countKey: "current" },
  ];

  const rowsByTab = {
    arrivals: data.arrivals,
    departures: data.departures,
    current: data.currentStays,
  };

  const operationalNumeric = [
    {
      label: t("dashboard.operational.checkIns"),
      value: operational.upcomingCheckIns,
      icon: CalendarCheck,
    },
    {
      label: t("dashboard.operational.checkOuts"),
      value: operational.upcomingCheckOuts,
      icon: CalendarX,
    },
    {
      label: t("dashboard.operational.activeStays"),
      value: operational.activeReservations,
      icon: BedDouble,
    },
    {
      label: t("dashboard.operational.pendingCleaning"),
      value: operational.pendingCleaning,
      icon: SprayCan,
    },
    {
      label: t("dashboard.operational.incidents"),
      value: operational.incidents,
      icon: AlertTriangle,
    },
  ];

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col px-4 py-5 pb-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("common.commandCenter")}
          description={t("dashboard.greeting", { name: displayName })}
          actions={
            <button
              type="button"
              className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-pragma-soft transition-colors hover:bg-accent"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              {t("dashboard.alertsButton")}
              {kpis.criticalAlerts > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                  {kpis.criticalAlerts}
                </span>
              ) : null}
            </button>
          }
        />

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("dashboard.kpi.occupancy")}
            value={`${kpis.occupancyMonthly}%`}
            detail={`Actual ${kpis.occupancyCurrent}% · mes ${kpis.occupancyMonthly}%`}
            icon={Percent}
            trend={occupancyTrend.trend}
            trendLabel={occupancyTrend.label}
          />
          <KpiCard
            label={t("dashboard.kpi.monthlyRevenue")}
            value={kpis.monthlyRevenueFormatted}
            detail={t("dashboard.kpiDetail.revenue", {
              amount: kpis.monthlyRevenueFormatted,
            })}
            icon={TrendingUp}
            trend={revenueTrend.trend}
            trendLabel={revenueTrend.label}
          />
          <KpiCard
            label="Egresos del mes"
            value={kpis.monthlyExpensesFormatted}
            detail="Limpieza y gastos operativos base"
            icon={Receipt}
            trend={expenseTrend.trend}
            trendLabel={expenseTrend.label}
          />
          <KpiCard
            label="Flujo neto"
            value={kpis.netFlowFormatted}
            detail="Ingresos − egresos (mes actual)"
            icon={Wallet}
            trend={netTrend.trend}
            trendLabel={netTrend.label}
          />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <DashboardTrendChart
            title="Ingresos"
            accentClass="bg-pragma-electric"
            bars={data.trendPoints.map((p) => ({
              label: p.label,
              value: p.revenue,
              formatted: formatMoney(p.revenue),
            }))}
          />
          <DashboardTrendChart
            title="Egresos"
            accentClass="bg-pragma-mid-gray"
            bars={data.trendPoints.map((p) => ({
              label: p.label,
              value: p.expenses,
              formatted: formatMoney(p.expenses),
            }))}
          />
          <DashboardTrendChart
            title="Flujo neto"
            accentClass="bg-primary"
            bars={data.trendPoints.map((p) => ({
              label: p.label,
              value: Math.max(0, p.net),
              formatted: formatMoney(p.net),
            }))}
          />
        </section>

        {showEmptyBanner ? (
          <div className="mb-6">
            <FirstPropertyBanner canCreate={canCreateProperties} />
          </div>
        ) : null}

        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <SectionCard
            title={t("dashboard.sections.operational")}
            description={t("dashboard.sections.operationalDesc")}
            className="lg:col-span-2"
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
              {operationalNumeric.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-pragma-light-blue/30 p-4"
                  >
                    <div className="flex items-center gap-2 text-pragma-electric">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-2 font-heading text-xl font-semibold text-foreground">
                      {item.value}
                    </p>
                  </div>
                );
              })}
              <div className="rounded-xl border border-border bg-pragma-light-blue/30 p-4">
                <div className="flex items-center gap-2 text-pragma-electric">
                  <KeyRound className="h-4 w-4" strokeWidth={1.75} />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("dashboard.operational.smartLock")}
                  </p>
                </div>
                <p className="mt-2 font-heading text-sm font-semibold text-foreground">
                  {operational.smartLockConfigured
                    ? t("dashboard.operational.smartLockReady")
                    : t("dashboard.operational.smartLockPending")}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t("dashboard.sections.alerts")}
            description={t("dashboard.sections.alertsDesc")}
          >
            <ul className="divide-y divide-border p-2 sm:p-4">
              {alerts.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.alerts.none")}
                </li>
              ) : (
                alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start gap-3 px-2 py-3 text-sm"
                  >
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        alert.severity === "critical"
                          ? "text-danger"
                          : "text-warning",
                      )}
                    />
                    <span className="text-foreground">{t(alert.messageKey as never)}</span>
                  </li>
                ))
              )}
            </ul>
          </SectionCard>
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <SectionCard
            title={t("dashboard.sections.calendar")}
            description={t("dashboard.sections.calendarDesc")}
            className="lg:col-span-2"
          >
            <div className="border-b border-border px-4 py-3 sm:px-6">
              <div
                className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1"
                role="tablist"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all",
                        isActive
                          ? "bg-card text-foreground shadow-pragma-soft ring-1 ring-pragma-cyan/20"
                          : "text-muted-foreground hover:bg-card/80",
                      )}
                    >
                      {t(`dashboard.tabs.${tab.labelKey}`)}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          isActive
                            ? "bg-pragma-soft-cyan text-pragma-electric"
                            : "bg-background text-muted-foreground",
                        )}
                      >
                        {data.counts[tab.countKey]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t(`dashboard.tabDesc.${activeTab === "arrivals" ? "checkIns" : activeTab === "departures" ? "checkOuts" : "active"}`)}
              </p>
            </div>
            <PanelReservationsTable
              tab={activeTab}
              rows={rowsByTab[activeTab]}
              downloadLabel={t(
                `dashboard.download.${activeTab === "arrivals" ? "checkIns" : activeTab === "departures" ? "checkOuts" : "active"}`,
              )}
            />
          </SectionCard>

          <SectionCard
            title={t("dashboard.sections.activity")}
            description={t("dashboard.sections.activityDesc")}
          >
            {activity.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t("common.noRecords")}
                description={t("common.noRecordsDetail")}
              />
            ) : (
              <ul className="pragma-scrollbar max-h-[min(420px,50vh)] divide-y divide-border overflow-y-auto p-2 sm:p-4">
                {activity.map((item) => (
                  <li key={item.id} className="px-2 py-3">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    <p className="mt-1 text-[11px] text-text-subtle">
                      {formatPanelDate(item.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/calendar" className="font-medium text-pragma-electric hover:underline">
            {t("nav.calendar")}
          </Link>
          {" · "}
          <Link href="/reservations" className="font-medium text-pragma-electric hover:underline">
            {t("nav.reservations")}
          </Link>
        </p>
      </div>
    </ModuleShellFlow>
  );
}
