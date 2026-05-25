"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { SmartpricePropertyPricingSection } from "@/features/revenue/components/smartprice-property-pricing-section";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { formatPriceLabsDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { metrics, integration } = overview;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-10 sm:px-6">
      <PageHeader
        eyebrow={t("smartprice.eyebrow")}
        title={t("smartprice.title")}
        description={t("smartprice.description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {metrics.syncedCount}/{metrics.propertyCount} sincronizadas
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/integrations/pricelabs">Integración PriceLabs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/calendar">{t("smartprice.actions.calendar")}</Link>
            </Button>
          </div>
        }
      />

      {billingLocked ? (
        <div className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
          {t("smartprice.billingLocked")}
        </div>
      ) : null}

      <Card className="border-pragma-soft-cyan/30 bg-pragma-soft-cyan/10 shadow-pragma-soft">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-pragma-electric" />
            {t("smartprice.context.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Resumen operativo del mes para evaluar ocupación, tarifa media y estado de sync.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PerformanceStat
            label={t("smartprice.context.occupancy")}
            value={finance?.occupancyRate ?? "—"}
            hint="Porcentaje de noches ocupadas este mes"
          />
          <PerformanceStat
            label={t("smartprice.context.adr")}
            value={
              finance?.adr
                ? formatMoney(finance.adr)
                : "—"
            }
            hint="Ingreso promedio por reserva"
          />
          <PerformanceStat
            label="Alojamientos activos"
            value={String(metrics.propertyCount)}
            hint="Propiedades con pricing en PRAGMA"
          />
          <PerformanceStat
            label="Última sync PriceLabs"
            value={formatPriceLabsDate(integration.lastPricesSyncAt)}
            hint="Fecha de la última importación de precios"
          />
        </CardContent>
      </Card>

      <SmartpricePropertyPricingSection
        properties={overview.properties}
        canEditPrices={canEditPrices}
        billingLocked={billingLocked}
      />
    </div>
  );
}

function PerformanceStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
