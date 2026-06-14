import { PropertyPriceLabsSyncStatus } from "@prisma/client";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { resolvePropertyDeltaForSort } from "@/features/revenue/lib/revenue-display-pricing";

export type RevenuePropertyRow = PriceLabsOverviewDto["properties"][number];

export function isRevenuePropertyAnomaly(property: RevenuePropertyRow): boolean {
  if (property.lastError) return true;
  if (property.syncStatus !== PropertyPriceLabsSyncStatus.SYNCED) return true;
  if (!property.listingId) return true;
  const delta = resolvePropertyDeltaForSort(property);
  return delta != null && Math.abs(delta) > 1;
}

export function parsePropertyDelta(property: RevenuePropertyRow): number | null {
  return resolvePropertyDeltaForSort(property);
}

export function propertyMatchesSearch(
  property: RevenuePropertyRow,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const unit = property.unitNumber?.toLowerCase() ?? "";
  const name = property.name.toLowerCase();
  const city = property.city?.toLowerCase() ?? "";
  const listing = property.insights.listingName?.toLowerCase() ?? "";
  return (
    unit.includes(q) ||
    name.includes(q) ||
    city.includes(q) ||
    listing.includes(q)
  );
}
