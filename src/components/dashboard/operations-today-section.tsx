"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
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

function TodayRow({
  row,
  mode,
  statusLabel,
}: {
  row: PanelReservationRow;
  mode: "arrival" | "departure";
  statusLabel: string;
}) {
  const router = useRouter();
  const unit = resolveUnitNumber(row);
  const time =
    mode === "arrival" ? row.property.checkInTime : row.property.checkOutTime;

  return (
    <button
      type="button"
      onClick={() => router.push(`/novedades?reservation=${row.id}`)}
      className="flex w-full items-center gap-4 border-b border-border/50 py-3.5 text-left transition-colors last:border-b-0 hover:bg-muted/15"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{row.guestName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {unit ?? row.property.name}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {time ? (
          <span className="text-sm tabular-nums text-foreground/80">{time}</span>
        ) : null}
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            mode === "arrival"
              ? "bg-pragma-olive-leaf/15 text-pragma-olive-leaf"
              : "bg-pragma-sand-oak/15 text-pragma-sand-oak",
          )}
        >
          {statusLabel}
        </span>
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
  statusLabel,
}: {
  title: string;
  count: number;
  rows: PanelReservationRow[];
  mode: "arrival" | "departure";
  emptyLabel: string;
  statusLabel: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div>
          {rows.map((row) => (
            <TodayRow
              key={row.id}
              row={row}
              mode={mode}
              statusLabel={statusLabel}
            />
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
    <section>
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {t("dashboard.sections.today")}
        </h2>
      </div>
      <div className={cn("grid gap-4", "md:grid-cols-2")}>
        <TodayColumn
          title={t("dashboard.today.arrivals")}
          count={counts.arrivals}
          rows={arrivals}
          mode="arrival"
          emptyLabel={t("dashboard.today.emptyArrivals")}
          statusLabel={t("dashboard.today.statusArrival")}
        />
        <TodayColumn
          title={t("dashboard.today.departures")}
          count={counts.departures}
          rows={departures}
          mode="departure"
          emptyLabel={t("dashboard.today.emptyDepartures")}
          statusLabel={t("dashboard.today.statusDeparture")}
        />
      </div>
    </section>
  );
}
