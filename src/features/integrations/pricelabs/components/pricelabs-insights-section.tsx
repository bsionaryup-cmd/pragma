"use client";

import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { cn } from "@/lib/utils";
import {
  formatPriceLabsDate,
  formatPriceLabsMoney,
  pricingHealthClass,
} from "@/features/integrations/pricelabs/lib/pricelabs-format";

type PriceLabsInsightsSectionProps = {
  overview: PriceLabsOverviewDto;
};

function Kpi({
  label,
  value,
  warn,
  className,
}: {
  label: string;
  value: string;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className="min-w-[6.5rem] shrink-0 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-base font-bold tabular-nums",
          warn && "text-warning",
          className,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function PriceLabsInsightsSection({ overview }: PriceLabsInsightsSectionProps) {
  const { insights, integration, metrics, revenue } = overview;

  return (
    <div className="space-y-3">
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        <Kpi
          label="Salud pricing"
          value={insights.pricingHealthLabel}
          className={pricingHealthClass(insights.pricingHealth)}
        />
        <Kpi
          label="Sync"
          value={`${metrics.syncedCount}/${metrics.propertyCount}`}
          warn={insights.unmappedListings > 0}
        />
        <Kpi
          label="Alertas Δ"
          value={String(insights.priceAlerts)}
          warn={insights.priceAlerts > 0}
        />
        <Kpi
          label="Issues sync"
          value={String(insights.syncIssues)}
          warn={insights.syncIssues > 0}
        />
        <Kpi label="DSO activos" value={String(insights.activeOverridesTotal)} />
        <Kpi label="Δ promedio" value={formatPriceLabsMoney(revenue.avgDelta)} />
        <Kpi
          label="Última sync"
          value={formatPriceLabsDate(integration.lastPricesSyncAt).split(",")[0] ?? "—"}
        />
      </div>

      {(insights.propertiesWithErrors.length > 0 ||
        insights.stayRuleWarnings > 0 ||
        insights.unmappedListings > 0) && (
        <div className="space-y-2 text-sm">
          {insights.unmappedListings > 0 ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
              {insights.unmappedListings} propiedad(es) sin listing mapeado en PriceLabs.
            </p>
          ) : null}
          {insights.propertiesWithErrors.length > 0 ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
              Errores: {insights.propertiesWithErrors.join(" · ")}
            </p>
          ) : null}
          {insights.stayRuleWarnings > 0 ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
              {insights.stayRuleWarnings} propiedad(es) con reglas de estancia mínima elevadas.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
