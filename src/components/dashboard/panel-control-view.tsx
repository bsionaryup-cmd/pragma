"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { PanelReservationsTable } from "@/components/dashboard/panel-reservations-table";
import { getPanelMotivationalMessage } from "@/lib/dashboard/panel-messages";
import type {
  PanelCounts,
  PanelReservationRow,
} from "@/services/dashboard/dashboard.service";
import { cn } from "@/lib/utils";

type PanelTab = "arrivals" | "departures" | "current";

type PanelControlViewProps = {
  firstName: string | null;
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

export function PanelControlView({
  counts,
  arrivals,
  departures,
  currentStays,
  showEmptyBanner,
  canCreateProperties,
}: PanelControlViewProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("arrivals");
  const headline = getPanelMotivationalMessage();

  const rowsByTab: Record<PanelTab, PanelReservationRow[]> = {
    arrivals,
    departures,
    current: currentStays,
  };

  return (
    <div className="flex min-h-full flex-col bg-white dark:bg-background">
      <header className="flex items-start justify-between gap-6 px-8 pb-2 pt-7">
        <h1 className="max-w-3xl text-xl font-bold leading-snug tracking-tight text-[#111111] dark:text-foreground sm:text-[1.65rem]">
          {headline}
        </h1>

        <button
          type="button"
          className="relative inline-flex shrink-0 items-center gap-2 pt-1 text-sm font-medium text-[#111111] hover:underline dark:text-foreground"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          Novedades
          <span className="absolute -right-2.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-1 text-[10px] font-bold text-white">
            0
          </span>
        </button>
      </header>

      <div className="flex-1 px-8 pb-8 pt-4">
        {showEmptyBanner ? (
          <div className="mb-6">
            <FirstPropertyBanner canCreate={canCreateProperties} />
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[#E9ECEF] bg-white shadow-pragma-soft dark:border-border dark:bg-card dark:shadow-none">
          <div className="border-b border-[#E9ECEF] px-6 dark:border-border">
            <div className="flex gap-8">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative py-4 text-sm font-medium transition-colors",
                      isActive
                        ? "text-[#111111] dark:text-foreground"
                        : "text-[#6B7280] hover:text-[#111111] dark:text-muted-foreground dark:hover:text-foreground",
                    )}
                  >
                    {tab.label} ({counts[tab.countKey]})
                    {isActive ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#111111] dark:bg-foreground" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <PanelReservationsTable
            tab={activeTab}
            rows={rowsByTab[activeTab]}
            downloadLabel={downloadLabels[activeTab]}
          />
        </div>
      </div>
    </div>
  );
}
