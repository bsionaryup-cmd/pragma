"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  LineChart,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { SmartpricePropertyPricingSection } from "@/features/revenue/components/smartprice-property-pricing-section";
import { useI18n } from "@/components/providers/i18n-provider";
import type {
  SmartpriceAttentionReason,
  SmartpriceAttentionItem,
} from "@/services/revenue/revenue-dashboard.service";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import {
  getPricingReasonBadgeClass,
} from "@/lib/ui/status-badge-styles";
import { cn } from "@/lib/utils";

type SmartpriceDashboardProps = {
  overview: PriceLabsOverviewDto;
  attention: SmartpriceAttentionItem[];
  finance: {
    occupancyRate: string | null;
    adr: string | null;
  } | null;
  billingLocked: boolean;
  canEditPrices: boolean;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

function formatSignedMoney(value: string | null, currency = "COP") {
  if (!value) return "—";
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return "—";
  const formatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

const REASON_LABEL_KEYS: Record<
  SmartpriceAttentionReason,
  "smartprice.reasons.underpriced" | "smartprice.reasons.overpriced" | "smartprice.reasons.sync_error" | "smartprice.reasons.pending_sync"
> = {
  underpriced: "smartprice.reasons.underpriced",
  overpriced: "smartprice.reasons.overpriced",
  sync_error: "smartprice.reasons.sync_error",
  pending_sync: "smartprice.reasons.pending_sync",
};

export function SmartpriceDashboard({
  overview,
  attention,
  finance,
  billingLocked,
  canEditPrices,
}: SmartpriceDashboardProps) {
  const { t } = useI18n();
  const { integration, metrics, revenue } = overview;

  const priceLabs = {
    syncedCount: metrics.syncedCount,
    propertyCount: metrics.propertyCount,
    lastPricesSyncAt: integration.lastPricesSyncAt,
    underpricedCount: revenue.underpricedCount,
    overpricedCount: revenue.overpricedCount,
    neutralCount: revenue.neutralCount,
    avgDelta: revenue.avgDelta,
  };

  const hasPricingData =
    priceLabs.propertyCount > 0 &&
    (priceLabs.underpricedCount > 0 ||
      priceLabs.overpricedCount > 0 ||
      priceLabs.neutralCount > 0 ||
      priceLabs.lastPricesSyncAt != null);

  const verdictKey =
    !hasPricingData
      ? "smartprice.verdict.noData"
      : attention.length > 0
        ? "smartprice.verdict.attention"
        : "smartprice.verdict.balanced";

  const verdictText =
    verdictKey === "smartprice.verdict.attention"
      ? t(verdictKey, { count: String(attention.length) })
      : t(verdictKey);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 pb-10 sm:px-6">
      <PageHeader
        eyebrow={t("smartprice.eyebrow")}
        title={t("smartprice.title")}
        description={t("smartprice.description")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">{t("smartprice.actions.calendar")}</Link>
          </Button>
        }
      />

      {billingLocked ? (
        <div className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
          {t("smartprice.billingLocked")}
        </div>
      ) : null}

      <Card className="border-pragma-soft-cyan/30 bg-pragma-soft-cyan/10 shadow-pragma-soft">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{verdictText}</p>
              {hasPricingData ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("smartprice.insight.neutral", {
                    count: String(priceLabs.neutralCount),
                  })}
                  {" · "}
                  {t("smartprice.insight.avgDelta")}: {formatMoney(priceLabs.avgDelta)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <p>{t("smartprice.insight.lastSync")}</p>
            <p className="font-medium text-foreground">
              {formatDate(priceLabs.lastPricesSyncAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("smartprice.stats.underpriced")}
          value={String(priceLabs.underpricedCount)}
          icon={TrendingDown}
          trend={priceLabs.underpricedCount > 0 ? "down" : undefined}
          trendLabel={
            priceLabs.underpricedCount > 0
              ? t("smartprice.reasons.underpriced")
              : undefined
          }
        />
        <KpiCard
          label={t("smartprice.stats.overpriced")}
          value={String(priceLabs.overpricedCount)}
          icon={TrendingUp}
          trend={priceLabs.overpricedCount > 0 ? "up" : undefined}
          trendLabel={
            priceLabs.overpricedCount > 0
              ? t("smartprice.reasons.overpriced")
              : undefined
          }
        />
        <KpiCard
          label={t("smartprice.stats.inRange")}
          value={String(priceLabs.neutralCount)}
          icon={Minus}
        />
        <KpiCard
          label={t("smartprice.stats.sync")}
          value={`${priceLabs.syncedCount}/${priceLabs.propertyCount}`}
          icon={LineChart}
        />
      </div>

      <SmartpricePropertyPricingSection
        properties={overview.properties}
        canEditPrices={canEditPrices}
        billingLocked={billingLocked}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-pragma-electric" />
            {t("smartprice.attention.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("smartprice.attention.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((item) => (
                <li
                  key={item.propertyId}
                  className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{item.propertyName}</p>
                    <p className="text-xs text-muted-foreground">{item.city}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge
                      variant="outline"
                      className={getPricingReasonBadgeClass(item.reason)}
                    >
                      {t(REASON_LABEL_KEYS[item.reason])}
                    </Badge>
                    {item.recommendedRate ? (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMoney(item.recommendedRate)}
                      </span>
                    ) : null}
                    {item.priceDelta ? (
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          item.reason === "underpriced" && "text-warning",
                          item.reason === "overpriced" && "text-info",
                        )}
                      >
                        {formatSignedMoney(item.priceDelta)}
                      </span>
                    ) : null}
                    <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                      <Link href={`/properties/${item.propertyId}`}>
                        {t("smartprice.attention.viewProperty")}
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChart className="h-4 w-4 text-pragma-electric" />
            {t("smartprice.context.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <Row label={t("smartprice.context.occupancy")} value={finance?.occupancyRate ?? "—"} />
          <Row label={t("smartprice.context.adr")} value={finance?.adr ?? "—"} />
          <Row
            label={t("smartprice.insight.avgDelta")}
            value={formatMoney(priceLabs.avgDelta)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
