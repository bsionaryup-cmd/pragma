"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PriceLabsInsightsSection } from "@/features/integrations/pricelabs/components/pricelabs-insights-section";
import { SmartpriceRevenueWorkstation } from "@/features/revenue/components/smartprice-revenue-workstation";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { formatPriceLabsDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type SmartpriceDashboardProps = {
  overview: PriceLabsOverviewDto;
  billingLocked: boolean;
  canEditPrices: boolean;
};

export function SmartpriceDashboard({
  overview,
  billingLocked,
  canEditPrices,
}: SmartpriceDashboardProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const { integration, properties, insights } = overview;
  const reviewCount = insights.listingsNeedingReview;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 pb-12 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pragma-electric">
            {t("smartprice.eyebrow")}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("smartprice.title")}
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1.5 font-semibold tabular-nums text-foreground">
              {reviewCount} por revisar
            </span>
            <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1.5 tabular-nums text-muted-foreground">
              {t("smartprice.insight.lastSync")}{" "}
              <span className="font-semibold text-foreground">
                {formatPriceLabsDate(integration.lastPricesSyncAt)}
              </span>
            </span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar APTO, nombre o ciudad…"
              className="h-9 pl-9 text-sm"
              aria-label="Buscar propiedad"
            />
          </div>
        </div>
      </header>

      {billingLocked ? (
        <div className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm font-medium text-warning">
          {t("smartprice.billingLocked")}
        </div>
      ) : null}

      {!overview.config.configured ? (
        <div className="rounded-xl border border-pragma-electric/30 bg-pragma-light-blue/40 px-4 py-3 text-sm text-foreground/90">
          {t("smartprice.setup.needsKeyHint")}{" "}
          <Link
            href="/integrations/pricelabs"
            className="font-semibold text-pragma-electric hover:underline"
          >
            Configurar PriceLabs
          </Link>
        </div>
      ) : null}

      <PriceLabsInsightsSection overview={overview} compact />

      <SmartpriceRevenueWorkstation
        properties={properties}
        canEditPrices={canEditPrices}
        billingLocked={billingLocked}
        reviewPropertyIds={insights.reviewPropertyIds}
        searchQuery={searchQuery}
      />
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
