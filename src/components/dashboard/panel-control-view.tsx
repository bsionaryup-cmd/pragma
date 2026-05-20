"use client";

import { useState } from "react";
import {
  BedDouble,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Percent,
} from "lucide-react";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { PanelReservationsTable } from "@/components/dashboard/panel-reservations-table";
import { getPanelMotivationalMessage } from "@/lib/dashboard/panel-messages";
import type {
  DashboardStats,
  PanelCounts,
  PanelReservationRow,
} from "@/services/dashboard/dashboard.service";
import { cn } from "@/lib/utils";

type PanelTab = "arrivals" | "departures" | "current";

type PanelControlViewProps = {
  firstName: string | null;
  stats: DashboardStats;
  counts: PanelCounts;
  arrivals: PanelReservationRow[];
  departures: PanelReservationRow[];
  currentStays: PanelReservationRow[];
  showEmptyBanner: boolean;
  canCreateProperties: boolean;
};

const tabs: { id: PanelTab; label: string; countKey: keyof PanelCounts }[] = [
  { id: "arrivals", label: "Próximas llegadas", countKey: "arrivals" },
  { id: "departures", label: "Próximas salidas", countKey: "departures" },
  { id: "current", label: "Alojados actualmente", countKey: "current" },
];

const downloadLabels: Record<PanelTab, string> = {
  arrivals: "Descargar llegadas",
  departures: "Descargar salidas",
  current: "Descargar alojados",
};

const tabDescriptions: Record<PanelTab, string> = {
  arrivals: "Llegadas confirmadas para los próximos 7 días.",
  departures: "Salidas programadas y estancias que cierran pronto.",
  current: "Huéspedes alojados actualmente en propiedades activas.",
};

export function PanelControlView({
  firstName,
  stats,
  counts,
  arrivals,
  departures,
  currentStays,
  showEmptyBanner,
  canCreateProperties,
}: PanelControlViewProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("arrivals");
  const headline = getPanelMotivationalMessage();
  const displayName = firstName?.trim() || "equipo";

  const rowsByTab: Record<PanelTab, PanelReservationRow[]> = {
    arrivals,
    departures,
    current: currentStays,
  };

  const kpis = [
    {
      label: "Ocupación",
      value: `${stats.occupancyRate}%`,
      detail: `${stats.activeReservations} reservas activas`,
      icon: Percent,
    },
    {
      label: "Llegadas hoy",
      value: stats.checkInsToday,
      detail: `${counts.arrivals} próximas`,
      icon: CalendarCheck,
    },
    {
      label: "Salidas hoy",
      value: stats.checkOutsToday,
      detail: `${counts.departures} próximas`,
      icon: CalendarX,
    },
    {
      label: "Alojados",
      value: counts.current,
      detail: "En estancia ahora",
      icon: BedDouble,
    },
    {
      label: "Propiedades activas",
      value: stats.activeProperties,
      detail: `${stats.totalProperties} en portafolio`,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Panel de Control
            </p>
            <h1 className="mt-2 max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {headline}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Hola, {displayName}. Revisa prioridades operativas, llegadas,
              salidas y ocupación desde una vista compacta.
            </p>
          </div>

          <button
            type="button"
            className="relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-pragma-soft transition-colors hover:bg-accent"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            Novedades
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
              0
            </span>
          </button>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;

            return (
              <article
                key={kpi.label}
                className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                </div>
                <p className="mt-3 truncate text-sm text-muted-foreground">
                  {kpi.detail}
                </p>
              </article>
            );
          })}
        </section>

        {showEmptyBanner ? (
          <div className="mb-5">
            <FirstPropertyBanner canCreate={canCreateProperties} />
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-pragma-soft">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Operación de reservas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tabDescriptions[activeTab]}
                </p>
              </div>

              <div
                className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1"
                aria-label="Vista operativa"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all",
                        isActive
                          ? "bg-card text-foreground shadow-pragma-soft"
                          : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-background text-muted-foreground",
                        )}
                      >
                        {counts[tab.countKey]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <PanelReservationsTable
            tab={activeTab}
            rows={rowsByTab[activeTab]}
            downloadLabel={downloadLabels[activeTab]}
          />
        </section>
      </div>
    </div>
  );
}
