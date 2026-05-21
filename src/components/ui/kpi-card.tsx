import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "flat";

type KpiCardProps = {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  trend?: Trend;
  trendLabel?: string;
  className?: string;
};

const trendStyles: Record<Trend, string> = {
  up: "text-emerald-600",
  down: "text-red-600",
  flat: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  trendLabel,
  className,
}: KpiCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card p-4 shadow-pragma-soft transition-shadow hover:shadow-pragma-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="font-heading mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      ) : null}
      {trend && trendLabel ? (
        <p className={cn("mt-2 text-xs font-medium", trendStyles[trend])}>{trendLabel}</p>
      ) : null}
    </article>
  );
}
