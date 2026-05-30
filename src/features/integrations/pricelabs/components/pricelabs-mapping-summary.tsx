"use client";

import Link from "next/link";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { syncStatusLabel } from "@/features/integrations/pricelabs/lib/pricelabs-format";

type PriceLabsMappingSummaryProps = {
  properties: PriceLabsOverviewDto["properties"];
};

function syncBadge(status: PriceLabsOverviewDto["properties"][number]["syncStatus"]) {
  switch (status) {
    case "SYNCED":
      return getSemanticBadgeClass("success");
    case "ERROR":
      return getSemanticBadgeClass("warning");
    default:
      return getSemanticBadgeClass("neutral");
  }
}

export function PriceLabsMappingSummary({ properties }: PriceLabsMappingSummaryProps) {
  if (properties.length === 0) {
    return (
      <p className="text-sm text-foreground/75">No hay propiedades activas.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground/70">
          Solo estado de vinculación. Tarifas, calendario y DSO en{" "}
          <Link href="/revenue" className="font-medium text-pragma-electric hover:underline">
            Tarifas
          </Link>
          .
        </p>
        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
          <Link href="/revenue">Ir a Tarifas</Link>
        </Button>
      </div>
      <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-card">
        {properties.map((property) => (
          <li
            key={property.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
          >
            <div className="min-w-0">
              <PropertyIdentity
                name={property.name}
                unitNumber={property.unitNumber}
                size="sm"
              />
              <p className="mt-0.5 truncate text-xs text-foreground/70">
                {property.listingId
                  ? `Listing …${property.listingId.slice(-8)}`
                  : "Sin listing mapeado"}
              </p>
            </div>
            <Badge variant="outline" className={syncBadge(property.syncStatus)}>
              {syncStatusLabel(property.syncStatus)}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
