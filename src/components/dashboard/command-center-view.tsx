"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardNovedadesSheet } from "@/components/dashboard/dashboard-novedades-sheet";
import { OperationsAttentionSection } from "@/components/dashboard/operations-attention-section";
import { OperationsFeedSection } from "@/components/dashboard/operations-feed-section";
import { OperationsFinanceSection } from "@/components/dashboard/operations-finance-section";
import { OperationsTodaySection } from "@/components/dashboard/operations-today-section";
import type { SystemAnnouncement } from "@/lib/system-announcements";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { FirstPropertyBanner } from "@/components/dashboard/first-property-banner";
import { PanelReservationsTable } from "@/components/dashboard/panel-reservations-table";
import { useI18n } from "@/components/providers/i18n-provider";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
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

  const greetingDescription =
    snapshot.attention.length > 0
      ? t("dashboard.greetingWithAttention", {
          name: displayName,
          count: snapshot.attention.length,
        })
      : t("dashboard.greeting", { name: displayName });

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 pb-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("common.commandCenter")}
          description={greetingDescription}
          actions={<DashboardNovedadesSheet announcements={novedades} />}
        />

        {showEmptyBanner ? (
          <FirstPropertyBanner canCreate={canCreateProperties} />
        ) : null}

        <OperationsAttentionSection items={snapshot.attention} />

        <OperationsTodaySection
          arrivals={data.todayArrivals}
          departures={data.todayDepartures}
          counts={data.todayCounts}
        />

        <SectionCard
          title={t("dashboard.sections.upcoming")}
          description={t("dashboard.sections.upcomingDesc")}
        >
          <div className="border-b border-border px-4 sm:px-6">
            <nav
              className="flex gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                      "shrink-0 border-b-2 pb-3 pt-4 text-sm font-medium transition-colors",
                      isActive
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`dashboard.tabs.${tab.labelKey}`)} ({data.counts[tab.countKey]})
                  </button>
                );
              })}
            </nav>
          </div>
          <PanelReservationsTable tab={activeTab} rows={rowsByTab[activeTab]} compactFooter />
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <OperationsFeedSection cards={snapshot.feedCards} />
          {snapshot.finance ? (
            <OperationsFinanceSection finance={snapshot.finance} />
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/calendar" className="font-medium text-pragma-electric hover:underline">
            {t("nav.calendar")}
          </Link>
          {" · "}
          <Link href="/novedades" className="font-medium text-pragma-electric hover:underline">
            {t("nav.novedades")}
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
