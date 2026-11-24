"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import type { CommandCenterData } from "@/services/dashboard/command-center.service";
import { cn } from "@/lib/utils";

type OperationsDonutStripProps = {
  data: CommandCenterData;
  degraded?: boolean;
};

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function Donut({
  ratio,
  valueLabel,
  label,
  detail,
  strokeClassName,
}: {
  ratio: number;
  valueLabel: string;
  label: string;
  detail?: string | null;
  strokeClassName: string;
}) {
  const filled = clampRatio(ratio) * CIRCUMFERENCE;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-card/50 p-3 sm:p-4">
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden>
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            className="stroke-muted/70"
          />
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            className={cn("transition-[stroke-dasharray] duration-500", strokeClassName)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-foreground">
          {valueLabel}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{label}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function OperationsDonutStrip({ data, degraded = false }: OperationsDonutStripProps) {
  const { t } = useI18n();

  const occupancy = Math.round(data.kpis.occupancyCurrent);
  const monthly = Math.round(data.kpis.occupancyMonthly);
  const totalProperties = data.totalPropertyCount;
  const activeStays = data.operational.activeReservations ?? data.counts.current;
  const { arrivals, departures } = data.todayCounts;

  // Count donuts are scaled against the portfolio size when known,
  // otherwise against the largest of the displayed values.
  const scale = Math.max(totalProperties, arrivals, departures, activeStays, 1);

  const propertiesDetail =
    totalProperties > 0
      ? t(
          totalProperties === 1
            ? "dashboard.donuts.ofPropertiesOne"
            : "dashboard.donuts.ofProperties",
          { count: totalProperties },
        )
      : null;

  return (
    <section aria-label={t("dashboard.donuts.title")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Donut
          ratio={occupancy / 100}
          valueLabel={`${occupancy}%`}
          label={t("dashboard.donuts.occupancy")}
          detail={t("dashboard.donuts.occupancyDetail", { month: monthly })}
          strokeClassName="stroke-primary"
        />
        <Donut
          ratio={arrivals / scale}
          valueLabel={String(arrivals)}
          label={t("dashboard.donuts.arrivals")}
          strokeClassName="stroke-pragma-olive-leaf"
        />
        <Donut
          ratio={departures / scale}
          valueLabel={String(departures)}
          label={t("dashboard.donuts.departures")}
          strokeClassName="stroke-pragma-sand-oak"
        />
        <Donut
          ratio={activeStays / scale}
          valueLabel={String(activeStays)}
          label={t("dashboard.donuts.activeStays")}
          detail={propertiesDetail}
          strokeClassName="stroke-primary"
        />
      </div>
      {degraded ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("dashboard.donuts.degradedNote")}
        </p>
      ) : null}
    </section>
  );
}
