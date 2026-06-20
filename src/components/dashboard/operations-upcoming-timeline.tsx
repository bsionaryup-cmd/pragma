"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import { formatPanelDate } from "@/lib/helpers/date";
import { cn } from "@/lib/utils";
import type { PanelReservationRow } from "@/services/dashboard/dashboard.service";

type PanelTab = "arrivals" | "departures" | "current";

type OperationsUpcomingTimelineProps = {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  rows: PanelReservationRow[];
  counts: { arrivals: number; departures: number; current: number };
};

function resolveUnitNumber(row: PanelReservationRow): string | null {
  if (row.property.unitDisplay) return row.property.unitDisplay;
  const unitLabel = resolveCalendarUnitLabel({
    name: row.property.name,
    unitNumber: row.property.unitNumber,
  });
  return unitLabel ? formatCalendarUnitDisplay(unitLabel) : null;
}

function dateForTab(row: PanelReservationRow, tab: PanelTab): string {
  if (tab === "departures") return formatPanelDate(row.checkOut);
  if (tab === "current") return formatPanelDate(row.checkIn);
  return formatPanelDate(row.checkIn);
}

export function OperationsUpcomingTimeline({
  activeTab,
  onTabChange,
  rows,
  counts,
}: OperationsUpcomingTimelineProps) {
  const { t } = useI18n();
  const router = useRouter();

  const tabs: { id: PanelTab; labelKey: "checkIns" | "checkOuts" | "active"; count: number }[] =
    [
      { id: "arrivals", labelKey: "checkIns", count: counts.arrivals },
      { id: "departures", labelKey: "checkOuts", count: counts.departures },
      { id: "current", labelKey: "active", count: counts.current },
    ];

  const statusLabel =
    activeTab === "departures"
      ? t("dashboard.today.statusDeparture")
      : activeTab === "current"
        ? t("dashboard.upcoming.statusInStay")
        : t("dashboard.today.statusArrival");

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-pragma-soft">
      <div className="border-b border-border/60 px-5 py-4 sm:px-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {t("dashboard.sections.upcoming")}
        </h2>
        <nav
          className="mt-4 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`dashboard.tabs.${tab.labelKey}`)} · {tab.count}
              </button>
            );
          })}
        </nav>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
          {t("common.noRecordsDetail")}
        </p>
      ) : (
        <ol className="relative px-5 py-2 sm:px-6">
          <div
            className="absolute bottom-4 left-[calc(1.25rem+3.5rem)] top-4 w-px bg-border/70 sm:left-[calc(1.5rem+3.5rem)]"
            aria-hidden
          />
          {rows.map((row, index) => {
            const unit = resolveUnitNumber(row);
            const dateLabel = dateForTab(row, activeTab);

            return (
              <li key={row.id} className="relative">
                <button
                  type="button"
                  onClick={() => router.push(`/novedades?reservation=${row.id}`)}
                  className="group flex w-full items-start gap-4 py-3.5 text-left transition-colors hover:bg-muted/10"
                >
                  <div className="w-14 shrink-0 pt-0.5">
                    <p className="text-xs font-medium tabular-nums text-muted-foreground">
                      {dateLabel}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "relative z-[1] mt-1.5 h-2 w-2 shrink-0 rounded-full ring-4 ring-card",
                      index === 0 ? "bg-pragma-caramel" : "bg-border",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.guestName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {unit ?? row.property.name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
