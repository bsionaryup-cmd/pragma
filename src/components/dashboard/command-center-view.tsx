"use client";

import { useState } from "react";
import { DashboardNovedadesSheet } from "@/components/dashboard/dashboard-novedades-sheet";
import { OperationsFinanceSection } from "@/components/dashboard/operations-finance-section";
import { OperationsTodaySection } from "@/components/dashboard/operations-today-section";
import { OperationsUpcomingTimeline } from "@/components/dashboard/operations-upcoming-timeline";
import type { SystemAnnouncement } from "@/lib/system-announcements";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { useI18n } from "@/components/providers/i18n-provider";
import { PageHeader } from "@/components/ui/page-header";
import type { OperationsCenterSnapshot } from "@/services/dashboard/operations-center.types";

type PanelTab = "arrivals" | "departures" | "current";

type CommandCenterViewProps = {
  firstName: string | null;
  snapshot: OperationsCenterSnapshot;
  showEmptyBanner: boolean;
  canCreateProperties: boolean;
  novedades: SystemAnnouncement[];
};

function resolveGreetingKey(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "evening";
}

function buildGreetingDescription(
  t: ReturnType<typeof useI18n>["t"],
  displayName: string,
  arrivals: number,
  departures: number,
): string {
  const period = resolveGreetingKey();
  const salutation = t(`dashboard.greetingPeriod.${period}`, { name: displayName });
  const dayLine =
    arrivals === 0 && departures === 0
      ? t("dashboard.allClear")
      : t("dashboard.today.summaryCounts", { arrivals, departures });
  return `${salutation}\n${dayLine}`;
}

export function CommandCenterView({
  firstName,
  snapshot,
  showEmptyBanner,
  canCreateProperties,
  novedades,
}: CommandCenterViewProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<PanelTab>("arrivals");
  const displayName = firstName?.trim() || t("common.team");
  const data = snapshot.commandCenter;

  const greetingDescription = buildGreetingDescription(
    t,
    displayName,
    data.todayCounts.arrivals,
    data.todayCounts.departures,
  );

  const rowsByTab = {
    arrivals: data.arrivals,
    departures: data.departures,
    current: data.currentStays,
  };

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 pb-12 sm:px-6 lg:gap-8 lg:px-8">
        <PageHeader
          title={t("common.commandCenter")}
          description={greetingDescription}
          className="mb-0"
          actions={<DashboardNovedadesSheet announcements={novedades} />}
        />

        {showEmptyBanner ? (
          <FirstPropertyBanner canCreate={canCreateProperties} />
        ) : null}

        <OperationsTodaySection
          arrivals={data.todayArrivals}
          departures={data.todayDepartures}
          counts={data.todayCounts}
        />

        <div className={snapshot.finance ? "grid gap-6 lg:grid-cols-2 lg:gap-8" : ""}>
          {snapshot.finance ? (
            <OperationsFinanceSection
              finance={snapshot.finance}
              trendPoints={data.trendPoints}
            />
          ) : null}

          <OperationsUpcomingTimeline
            activeTab={activeTab}
            onTabChange={setActiveTab}
            rows={rowsByTab[activeTab]}
            counts={data.counts}
          />
        </div>
      </div>
    </ModuleShellFlow>
  );
}
