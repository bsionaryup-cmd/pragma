"use client";

import { useMemo, useState } from "react";
import { DashboardNovedadesSheet } from "@/components/dashboard/dashboard-novedades-sheet";
import { OperationsAttentionSection } from "@/components/dashboard/operations-attention-section";
import { OperationsFeedSection } from "@/components/dashboard/operations-feed-section";
import { OperationsFinanceSection } from "@/components/dashboard/operations-finance-section";
import { OperationsTodaySection } from "@/components/dashboard/operations-today-section";
import { OperationsUpcomingTimeline } from "@/components/dashboard/operations-upcoming-timeline";
import type { SystemAnnouncement } from "@/lib/system-announcements";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { useI18n } from "@/components/providers/i18n-provider";
import { PageHeader } from "@/components/ui/page-header";
import type { OperationsCenterSnapshot } from "@/services/dashboard/operations-center.types";
import { cn } from "@/lib/utils";

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

function priorityAttentionCount(items: OperationsCenterSnapshot["attention"]): number {
  const kinds = new Set(["messages", "registration", "ttlock", "payment"]);
  return items.filter((item) => kinds.has(item.kind)).length;
}

function buildGreetingDescription(
  t: ReturnType<typeof useI18n>["t"],
  displayName: string,
  attentionCount: number,
): string {
  const period = resolveGreetingKey();
  const salutation = t(`dashboard.greetingPeriod.${period}`, { name: displayName });

  if (attentionCount > 0) {
    return `${salutation}\n${t("dashboard.attentionSummary", { count: attentionCount })}`;
  }

  return `${salutation}\n${t("dashboard.allClear")}`;
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
  const attentionCount = useMemo(
    () => priorityAttentionCount(snapshot.attention),
    [snapshot.attention],
  );

  const greetingDescription = buildGreetingDescription(
    t,
    displayName,
    attentionCount,
  );

  const rowsByTab = {
    arrivals: data.arrivals,
    departures: data.departures,
    current: data.currentStays,
  };

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 pb-12 sm:px-6 lg:gap-10 lg:px-8">
        <PageHeader
          title={t("common.commandCenter")}
          description={greetingDescription}
          className="mb-0"
          actions={<DashboardNovedadesSheet announcements={novedades} />}
        />

        {showEmptyBanner ? (
          <FirstPropertyBanner canCreate={canCreateProperties} />
        ) : null}

        <div
          className={cn(
            "grid gap-6 lg:gap-8",
            snapshot.finance ? "lg:grid-cols-2" : "",
          )}
        >
          <OperationsAttentionSection items={snapshot.attention} />
          {snapshot.finance ? (
            <OperationsFinanceSection
              finance={snapshot.finance}
              trendPoints={data.trendPoints}
            />
          ) : null}
        </div>

        <OperationsTodaySection
          arrivals={data.todayArrivals}
          departures={data.todayDepartures}
          counts={data.todayCounts}
        />

        <OperationsUpcomingTimeline
          activeTab={activeTab}
          onTabChange={setActiveTab}
          rows={rowsByTab[activeTab]}
          counts={data.counts}
        />

        <OperationsFeedSection cards={snapshot.feedCards} />
      </div>
    </ModuleShellFlow>
  );
}
