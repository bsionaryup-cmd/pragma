"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { PanelReservationsTable } from "@/components/dashboard/panel-reservations-table";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
  firstName,
  counts,
  arrivals,
  departures,
  currentStays,
  showEmptyBanner,
  canCreateProperties,
}: PanelControlViewProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("arrivals");

  const rowsByTab: Record<PanelTab, PanelReservationRow[]> = {
    arrivals,
    departures,
    current: currentStays,
  };

  const headline = firstName
    ? `${firstName}, no te olvides de descansar`
    : "No te olvides de descansar";

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="relative px-8 pt-8">
        <h1 className="text-center text-[2rem] font-bold leading-tight tracking-tight text-[#1a1a1a] sm:text-[2.35rem]">
          {headline}
          <span className="ml-2" aria-hidden>
            🧘
          </span>
        </h1>

        <div className="absolute right-8 top-8 flex items-center gap-3">
          <button
            type="button"
            className="relative inline-flex items-center gap-2 text-sm font-medium text-[#1a1a1a] hover:underline"
          >
            <Bell className="h-5 w-5" />
            Novedades
            <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e53935] px-1 text-[10px] font-bold text-white">
              0
            </span>
          </button>
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9" },
            }}
          />
        </div>
      </header>

      <div className="flex-1 px-8 pb-8 pt-10">
        {showEmptyBanner ? (
          <div className="mb-8">
            <FirstPropertyBanner canCreate={canCreateProperties} />
          </div>
        ) : null}

        <div className="border-b border-[#ebebeb]">
          <div className="flex gap-8">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative pb-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-[#1a1a1a]"
                      : "text-[#6b6b6b] hover:text-[#1a1a1a]",
                  )}
                >
                  {tab.label} ({counts[tab.countKey]})
                  {isActive ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#1a1a1a]" />
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
  );
}
