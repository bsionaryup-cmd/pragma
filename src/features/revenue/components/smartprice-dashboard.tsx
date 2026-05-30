"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Settings2, TrendingUp } from "lucide-react";
import { PriceLabsInsightsSection } from "@/features/integrations/pricelabs/components/pricelabs-insights-section";
import { PriceLabsPropertyDetailCard } from "@/features/integrations/pricelabs/components/pricelabs-property-detail-card";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { formatPriceLabsDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

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
  const canManage = canEditPrices && !billingLocked;

  const sortedProperties = useMemo(() => {
    const review = new Set(insights.reviewPropertyIds);
    return [...properties].sort((a, b) => {
      const aReview = review.has(a.id) ? 0 : 1;
      const bReview = review.has(b.id) ? 0 : 1;
      if (aReview !== bReview) return aReview - bReview;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
  }, [properties, insights.reviewPropertyIds]);

  const defaultOpenId =
    insights.reviewPropertyIds[0] ??
    properties.find((p) => !p.listingId)?.id ??
    null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-4 pb-10 sm:px-5">
      <PageHeader
        eyebrow={t("smartprice.eyebrow")}
        title={t("smartprice.title")}
        description={t("smartprice.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-pragma-cyan/40 bg-pragma-soft-cyan/30 px-2.5 py-1 text-xs font-medium tabular-nums text-foreground">
              {metrics.syncedCount}/{metrics.propertyCount} sync
            </span>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Link href="/integrations/pricelabs">
                <Settings2 className="h-3.5 w-3.5" />
                Conexión API
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link href="/calendar">{t("smartprice.actions.calendar")}</Link>
            </Button>
          </div>
        }
      />

      {billingLocked ? (
        <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2.5 text-sm text-warning">
          {t("smartprice.billingLocked")}
        </div>
      ) : null}

      {!overview.config.configured ? (
        <div className="rounded-lg border border-pragma-electric/30 bg-pragma-light-blue/40 px-3 py-2.5 text-sm text-foreground/85">
          {t("smartprice.setup.needsKeyHint")}{" "}
          <Link
            href="/integrations/pricelabs"
            className="font-medium text-pragma-electric hover:underline"
          >
            Configurar PriceLabs
          </Link>
        </div>
      ) : null}

      <PriceLabsInsightsSection overview={overview} />

      <section className="rounded-lg border border-border border-l-[3px] border-l-pragma-cyan bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <TrendingUp className="h-4 w-4 text-pragma-electric" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("smartprice.context.title")}
          </h2>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <PerformanceStat
            label={t("smartprice.context.occupancy")}
            value={finance?.occupancyRate ?? "—"}
          />
          <PerformanceStat
            label={t("smartprice.context.adr")}
            value={finance?.adr ? formatMoney(finance.adr) : "—"}
          />
          <PerformanceStat
            label="Propiedades"
            value={String(metrics.propertyCount)}
          />
          <PerformanceStat
            label="Última sync"
            value={formatPriceLabsDate(integration.lastPricesSyncAt)}
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Alojamientos · {properties.length}
          </h2>
          <p className="text-xs text-foreground/70">
            Límites, calendario 14d, overrides y sync por unidad
          </p>
        </div>
        {sortedProperties.length === 0 ? (
          <p className="text-sm text-foreground/75">No hay propiedades activas.</p>
        ) : (
          <div className="space-y-2">
            {sortedProperties.map((property) => (
              <PriceLabsPropertyDetailCard
                key={property.id}
                property={property}
                canManage={canManage}
                defaultOpen={property.id === defaultOpenId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PerformanceStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-pragma-light-blue/20 px-2.5 py-2">
      <p className="text-[11px] font-medium text-foreground/70">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
