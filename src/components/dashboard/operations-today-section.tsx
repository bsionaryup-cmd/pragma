"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import { SectionCard } from "@/components/ui/section-card";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import { Clock } from "lucide-react";
import type { PanelReservationRow } from "@/services/dashboard/dashboard.service";
import type { TodayPanelCounts } from "@/services/dashboard/dashboard.service";
import { cn } from "@/lib/utils";

type OperationsTodaySectionProps = {
  arrivals: PanelReservationRow[];
  departures: PanelReservationRow[];
  counts: TodayPanelCounts;
};

function resolveUnitNumber(row: PanelReservationRow): string | null {
  if (row.property.unitDisplay) return row.property.unitDisplay;
  const unitLabel = resolveCalendarUnitLabel({
    name: row.property.name,
    unitNumber: row.property.unitNumber,
  });
  return unitLabel ? formatCalendarUnitDisplay(unitLabel) : null;
}

function TodayRow({ row, mode }: { row: PanelReservationRow; mode: "arrival" | "departure" }) {
  const router = useRouter();
  const unit = resolveUnitNumber(row);
  const time =
    mode === "arrival" ? row.property.checkInTime : row.property.checkOutTime;

  return (
    <button
      type="button"
      onClick={() => router.push(`/novedades?reservation=${row.id}`)}
      className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/20"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {row.property.coverImageUrl ? (
          <Image src={row.property.coverImageUrl} alt="" fill className="object-cover" sizes="40px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {(unit ?? row.property.name).slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{row.guestName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {unit ? `${unit} · ` : ""}
          {row.property.name}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <PlatformBadge platform={row.platform} />
        {time ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {time}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function TodayColumn({
  title,
  count,
  rows,
  mode,
  emptyLabel,
}: {
  title: string;
  count: number;
  rows: PanelReservationRow[];
  mode: "arrival" | "departure";
  emptyLabel: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <TodayRow key={row.id} row={row} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OperationsTodaySection({
  arrivals,
  departures,
  counts,
}: OperationsTodaySectionProps) {
  const { t } = useI18n();

  return (
    <SectionCard title={t("dashboard.sections.today")} description={t("dashboard.sections.todayDesc")}>
      <div className={cn("grid gap-6 px-4 pb-5 sm:px-6", "md:grid-cols-2")}>
        <TodayColumn
          title={t("dashboard.today.arrivals")}
          count={counts.arrivals}
          rows={arrivals}
          mode="arrival"
          emptyLabel={t("dashboard.today.emptyArrivals")}
        />
        <TodayColumn
          title={t("dashboard.today.departures")}
          count={counts.departures}
          rows={departures}
          mode="departure"
          emptyLabel={t("dashboard.today.emptyDepartures")}
        />
      </div>
    </SectionCard>
  );
}
