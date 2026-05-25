"use client";

import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { cn } from "@/lib/utils";
import { formatPriceLabsDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";

type PriceLabsInsightsSectionProps = {
  overview: PriceLabsOverviewDto;
};

function syncBadgeClass(status: PriceLabsOverviewDto["insights"]["lastSyncStatus"]) {
  switch (status) {
    case "fresh":
      return getSemanticBadgeClass("success");
    case "stale":
      return getSemanticBadgeClass("warning");
    case "error":
      return getSemanticBadgeClass("warning");
    default:
      return getSemanticBadgeClass("neutral");
  }
}

export function PriceLabsInsightsSection({ overview }: PriceLabsInsightsSectionProps) {
  const { insights, integration } = overview;

  const cards = [
    {
      label: "Estado de sync",
      value: insights.lastSyncLabel,
      icon: RefreshCw,
      highlight: insights.lastSyncStatus === "stale" || insights.lastSyncStatus === "error",
    },
    {
      label: "Issues de sync",
      value: String(insights.syncIssues),
      icon: ShieldAlert,
      highlight: insights.syncIssues > 0,
    },
  ];

  return (
    <Card className="border-border bg-card shadow-pragma-soft">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Panel operativo de revenue</CardTitle>
          <Badge variant="outline" className={syncBadgeClass(insights.lastSyncStatus)}>
            {insights.lastSyncLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border/70 bg-muted/20 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <card.icon className="h-3.5 w-3.5" />
                {card.label}
              </div>
              <p
                className={cn(
                  "mt-2 text-lg font-semibold tabular-nums",
                  card.highlight && "text-warning",
                )}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Stat label="Sin mapeo PL" value={String(insights.unmappedListings)} warn={insights.unmappedListings > 0} />
          <Stat label="Última sync precios" value={formatPriceLabsDate(integration.lastPricesSyncAt)} />
        </div>

        {insights.propertiesWithErrors.length > 0 ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <p className="font-medium text-destructive">Propiedades con error de sync</p>
            <p className="mt-1 text-muted-foreground">
              {insights.propertiesWithErrors.join(" · ")}
            </p>
          </div>
        ) : null}

        {insights.stayRuleWarnings > 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              {insights.stayRuleWarnings} propiedad(es) con reglas de estancia mínima elevadas
              o overrides de min nights en los próximos 14 días.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", warn && "text-warning")}>{value}</p>
    </div>
  );
}
