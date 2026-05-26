"use client";

import { useState } from "react";
import { ChevronDown, Link2 } from "lucide-react";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { cn } from "@/lib/utils";
import { PropertyIdentity } from "@/components/properties/property-identity";
import {
  formatPriceLabsDate,
  formatPriceLabsMoney,
  formatShortDate,
  matchReasonLabel,
  syncStatusLabel,
} from "@/features/integrations/pricelabs/lib/pricelabs-format";

type PropertyRow = PriceLabsOverviewDto["properties"][number];

type PriceLabsPropertyDetailCardProps = {
  property: PropertyRow;
  defaultOpen?: boolean;
};

function syncBadge(status: PropertyRow["syncStatus"]) {
  switch (status) {
    case "SYNCED":
      return getSemanticBadgeClass("success");
    case "ERROR":
      return getSemanticBadgeClass("warning");
    default:
      return getSemanticBadgeClass("neutral");
  }
}

export function PriceLabsPropertyDetailCard({
  property,
  defaultOpen = false,
}: PriceLabsPropertyDetailCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { insights } = property;

  return (
    <Card className="overflow-hidden border-border bg-card shadow-pragma-soft">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <PropertyIdentity
              name={property.name}
              unitNumber={property.unitNumber}
              listingName={insights.listingName}
              size="md"
            />
            <p className="mt-1 text-sm text-muted-foreground">{property.city}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={syncBadge(property.syncStatus)}>
              {syncStatusLabel(property.syncStatus)}
            </Badge>
            {insights.overrideCount > 0 ? (
              <Badge variant="outline">{insights.overrideCount} override(s)</Badge>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Ocultar" : "Ver detalle"}
              <ChevronDown className={cn("ml-1 h-4 w-4 transition", open && "rotate-180")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Listing PL" value={property.listingId ? `…${property.listingId.slice(-8)}` : "Sin mapeo"} />
          <Metric label="Recomendado" value={formatPriceLabsMoney(property.recommendedRate)} accent />
          <Metric label="Base / Mín / Máx" value={`${formatPriceLabsMoney(property.listingBase ?? property.baseRate)} · ${formatPriceLabsMoney(property.minRate)} · ${formatPriceLabsMoney(property.maxRate)}`} />
          <Metric label="Última sync" value={formatPriceLabsDate(property.lastSyncedAt)} />
        </div>

        {property.lastError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {property.lastError}
          </p>
        ) : null}

        {open ? (
          <div className="space-y-4 border-t border-border/60 pt-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Listing name" value={insights.listingName ?? "—"} />
              <Detail label="PMS origen" value={insights.listingPms ?? "—"} />
              <Detail label="Fuente pricing" value={insights.pricingSource ?? "—"} />
              <Detail label="Match PRAGMA ↔ PL" value={matchReasonLabel(insights.matchReason)} />
              <Detail label="Estancia mín. hoy" value={insights.minStayToday != null ? `${insights.minStayToday} noche(s)` : "—"} />
              <Detail label="Weekend uplift" value={property.weekendUpliftPct ? `${property.weekendUpliftPct}%` : "—"} />
              <Detail label="Sync precios" value={formatPriceLabsDate(insights.lastPricesSync)} />
              <Detail label="Sync overrides" value={formatPriceLabsDate(insights.lastOverridesSync)} />
              <Detail label="Ocupación PL" value={property.occupancy ?? "—"} />
            </div>

            {insights.ratePlanHints.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ajustes / rate plan detectados
                </p>
                <div className="flex flex-wrap gap-2">
                  {insights.ratePlanHints.map((hint) => (
                    <Badge key={hint} variant="outline">
                      {hint}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-pragma-electric" />
                <p className="text-sm font-medium">Próximos 14 días</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {insights.next14Days.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center text-xs",
                      day.hasOverride && "border-pragma-cyan/40 bg-pragma-soft-cyan/20",
                    )}
                  >
                    <p className="font-medium">{formatShortDate(day.date)}</p>
                    <p className="mt-1 tabular-nums text-success">
                      {formatPriceLabsMoney(day.recommended)}
                    </p>
                    {day.minStay != null && day.minStay > 1 ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        min {day.minStay}n
                      </p>
                    ) : null}
                    {day.hasOverride ? (
                      <p className="mt-0.5 text-[10px] font-medium text-pragma-electric">DSO</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {insights.upcomingOverrides.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Overrides próximos
                </p>
                <ul className="space-y-1 text-sm">
                  {insights.upcomingOverrides.map((row) => (
                    <li key={row.date} className="flex justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                      <span>{formatShortDate(row.date)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.price != null ? formatPriceLabsMoney(row.price) : "—"}
                        {row.minStay != null ? ` · min ${row.minStay}n` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", accent && "text-success")}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
