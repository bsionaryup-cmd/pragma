"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { PriceLabsInsightsSection } from "@/features/integrations/pricelabs/components/pricelabs-insights-section";
import { SmartpriceRevenueWorkstation } from "@/features/revenue/components/smartprice-revenue-workstation";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { formatPriceLabsDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

type SmartpriceDashboardProps = {
  overview: PriceLabsOverviewDto;
  finance: {
    occupancyRate: string | null;
    adr: string | null;
  } | null;
  billingLocked: boolean;
  canEditPrices: boolean;
};

function formatMoney(value: string | null, currency = "COP") {
  if (!value) return "—";
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SmartpriceDashboard({
  overview,
  finance,
  billingLocked,
  canEditPrices,
}: SmartpriceDashboardProps) {
  const { t } = useI18n();
  const { metrics, integration, properties, insights } = overview;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-12 sm:px-6">
      <PageHeader
        eyebrow={t("smartprice.eyebrow")}
        title={t("smartprice.title")}
        description={t("smartprice.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-pragma-cyan/40 bg-pragma-soft-cyan/30 px-3 py-1.5 text-sm font-semibold tabular-nums text-foreground">
              {metrics.syncedCount}/{metrics.propertyCount} sync
            </span>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
              <Link href="/integrations/pricelabs">
                <Settings2 className="h-4 w-4" />
                Conexión API
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 text-sm">
              <Link href="/calendar">{t("smartprice.actions.calendar")}</Link>
            </Button>
          </div>
        }
      />

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

      <PriceLabsInsightsSection overview={overview} />

      <div className="grid gap-3 sm:grid-cols-3">
        <ContextStat label={t("smartprice.context.occupancy")} value={finance?.occupancyRate ?? "—"} />
        <ContextStat
          label={t("smartprice.context.adr")}
          value={finance?.adr ? formatMoney(finance.adr) : "—"}
        />
        <ContextStat
          label="Última sync precios"
          value={formatPriceLabsDate(integration.lastPricesSyncAt)}
        />
      </div>

      <SmartpriceRevenueWorkstation
        properties={properties}
        canEditPrices={canEditPrices}
        billingLocked={billingLocked}
        reviewPropertyIds={insights.reviewPropertyIds}
      />
    </div>
  );
}

function ContextStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-3 shadow-pragma-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
