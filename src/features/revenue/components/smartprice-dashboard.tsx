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
import { useI18n } from "@/components/providers/i18n-provider";
import type {
  SmartpriceAttentionReason,
  SmartpriceDashboardDto,
} from "@/services/revenue/revenue-dashboard.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SmartpriceDashboardProps = {
  data: SmartpriceDashboardDto;
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

export function SmartpriceDashboard({ data }: SmartpriceDashboardProps) {
  const { t } = useI18n();
  const { priceLabs, finance, billingLocked, attention } = data;

  const hasPricingData =
    priceLabs.configured &&
    priceLabs.propertyCount > 0 &&
    (priceLabs.underpricedCount > 0 ||
      priceLabs.overpricedCount > 0 ||
      priceLabs.neutralCount > 0);

  const verdictKey = !priceLabs.configured
    ? "smartprice.verdict.noData"
    : attention.length > 0
      ? "smartprice.verdict.attention"
      : "smartprice.verdict.balanced";

  const verdictText =
    verdictKey === "smartprice.verdict.attention"
      ? t(verdictKey, { count: String(attention.length) })
      : t(verdictKey);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0E9F8D]">
            {t("smartprice.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {t("smartprice.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("smartprice.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">{t("smartprice.actions.calendar")}</Link>
          </Button>
          {!billingLocked ? (
            <Button asChild size="sm" className="bg-[#0E9F8D] hover:bg-[#0c8a7a]">
              <Link href="/integrations/pricelabs">
                {t("smartprice.pricelabs.open")}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {billingLocked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("smartprice.billingLocked")}
        </div>
      ) : null}

      <Card className="border-[#0E9F8D]/20 bg-gradient-to-br from-[#0E9F8D]/5 via-background to-background">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#0E9F8D]/10 p-2.5 text-[#0E9F8D]">
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
        <StatCard
          label={t("smartprice.stats.underpriced")}
          value={String(priceLabs.underpricedCount)}
          warn={priceLabs.underpricedCount > 0}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label={t("smartprice.stats.overpriced")}
          value={String(priceLabs.overpricedCount)}
          warn={priceLabs.overpricedCount > 0}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label={t("smartprice.stats.inRange")}
          value={String(priceLabs.neutralCount)}
          icon={<Minus className="h-4 w-4" />}
        />
        <StatCard
          label={t("smartprice.stats.sync")}
          value={`${priceLabs.syncedCount}/${priceLabs.propertyCount}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-[#0E9F8D]" />
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
                    <ReasonBadge
                      reason={item.reason}
                      label={t(REASON_LABEL_KEYS[item.reason])}
                    />
                    {item.recommendedRate ? (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMoney(item.recommendedRate)}
                      </span>
                    ) : null}
                    {item.priceDelta ? (
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          item.reason === "underpriced" && "text-amber-600",
                          item.reason === "overpriced" && "text-sky-700",
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-[#0E9F8D]" />
              {t("smartprice.pricelabs.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row
              label={t("smartprice.pricelabs.status")}
              value={
                <Badge variant="outline">
                  {priceLabs.configured
                    ? priceLabs.connected
                      ? t("smartprice.pricelabs.connected")
                      : t("smartprice.pricelabs.configured")
                    : t("smartprice.pricelabs.missing")}
                </Badge>
              }
            />
            <Row
              label={t("smartprice.insight.avgDelta")}
              value={formatMoney(priceLabs.avgDelta)}
            />
            <Row
              label={t("smartprice.insight.lastSync")}
              value={formatDate(priceLabs.lastPricesSyncAt)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("smartprice.context.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {finance ? (
              <>
                <Row label={t("smartprice.context.occupancy")} value={finance.occupancyRate ?? "—"} />
                <Row label={t("smartprice.context.adr")} value={finance.adr ?? "—"} />
              </>
            ) : (
              <p className="text-muted-foreground">{t("smartprice.context.empty")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  warn,
  icon,
}: {
  label: string;
  value: string;
  warn?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border-border/80">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums",
            warn && "text-amber-600",
          )}
        >
          {icon}
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ReasonBadge({ reason, label }: { reason: string; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        reason === "underpriced" && "border-amber-300 text-amber-800",
        reason === "overpriced" && "border-sky-300 text-sky-800",
        reason === "sync_error" && "border-red-300 text-red-800",
        reason === "pending_sync" && "border-slate-300 text-slate-700",
      )}
    >
      {label}
    </Badge>
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
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
