"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { PriceLabsInsightsSection } from "@/features/integrations/pricelabs/components/pricelabs-insights-section";
import { SmartpriceRevenueWorkstation } from "@/features/revenue/components/smartprice-revenue-workstation";
import { syncRevenuePricesAction } from "@/features/revenue/actions/smartprice.actions";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import {
  formatRelativeSync,
  formatPriceLabsDate,
} from "@/features/integrations/pricelabs/lib/pricelabs-format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const { integration, properties, insights, syncing } = overview;
  const reviewCount = insights.listingsNeedingReview;
  const lastSync =
    integration.lastPricesSyncAt ??
    properties.find((p) => p.lastSyncedAt)?.lastSyncedAt ??
    null;
  const canSync = canEditPrices && !billingLocked && overview.config.configured;

  const onSyncNow = () => {
    startTransition(async () => {
      try {
        const result = await syncRevenuePricesAction();
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 pb-12 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-pragma-electric">
            {t("smartprice.eyebrow")}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("smartprice.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dashboard de tarifas · {properties.length} listado
            {properties.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                syncing || pending
                  ? "border-pragma-electric/40 bg-pragma-light-blue/50 text-pragma-electric"
                  : insights.lastSyncStatus === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border/80 bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  syncing || pending
                    ? "animate-pulse bg-pragma-electric"
                    : insights.lastSyncStatus === "fresh"
                      ? "bg-emerald-500"
                      : insights.lastSyncStatus === "error"
                        ? "bg-destructive"
                        : "bg-amber-500",
                )}
              />
              {syncing || pending
                ? "Sincronizando…"
                : `Última sync ${formatRelativeSync(lastSync)}`}
            </span>
            <span className="rounded-full border border-border/80 bg-muted/30 px-3 py-1.5 text-sm font-semibold tabular-nums text-foreground">
              {reviewCount} por revisar
            </span>
            {canSync ? (
              <Button
                type="button"
                size="sm"
                disabled={pending || syncing}
                onClick={onSyncNow}
                className="h-9 gap-1.5 bg-pragma-electric font-semibold hover:bg-pragma-mid-blue"
              >
                {pending || syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sincronizar ahora
              </Button>
            ) : null}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nombre o ciudad…"
              className="h-9 pl-9 text-sm"
              aria-label="Buscar propiedad"
            />
          </div>
          {lastSync ? (
            <p className="text-[11px] text-muted-foreground">
              Snapshot: {formatPriceLabsDate(lastSync)}
            </p>
          ) : null}
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
        auditLog={overview.auditLog}
        syncing={syncing || pending}
      />
    </div>
  );
}

/** @deprecated Use SmartpriceDashboard */
export const RevenueDashboard = SmartpriceDashboard;
