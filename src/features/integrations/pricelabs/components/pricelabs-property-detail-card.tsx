"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deletePriceLabsOverridesAction,
  savePriceLabsOverrideAction,
  savePropertyPriceBoundsAction,
  syncSinglePriceLabsListingAction,
} from "@/features/revenue/actions/smartprice.actions";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { cn } from "@/lib/utils";
import {
  demandLevelClass,
  formatPriceDelta,
  formatPriceLabsDate,
  formatPriceLabsMoney,
  formatShortDate,
  matchReasonLabel,
  syncStatusLabel,
} from "@/features/integrations/pricelabs/lib/pricelabs-format";

type PropertyRow = PriceLabsOverviewDto["properties"][number];

type PriceLabsPropertyDetailCardProps = {
  property: PropertyRow;
  canManage: boolean;
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

function MetaRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-xs text-foreground/70">{label}</span>
      {children ?? (
        <span className="min-w-0 truncate text-right font-medium">{value ?? "—"}</span>
      )}
    </div>
  );
}

export function PriceLabsPropertyDetailCard({
  property,
  canManage,
  defaultOpen = false,
}: PriceLabsPropertyDetailCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const { insights } = property;

  const [minRate, setMinRate] = useState(property.minRate ?? "");
  const [baseRate, setBaseRate] = useState(property.baseRate ?? "");
  const [maxRate, setMaxRate] = useState(property.maxRate ?? "");

  const [overrideDate, setOverrideDate] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideMinStay, setOverrideMinStay] = useState("");
  const [overrideMinPrice, setOverrideMinPrice] = useState("");
  const [overrideMaxPrice, setOverrideMaxPrice] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      try {
        const result = await fn();
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

  const deltaNum =
    property.priceDelta != null ? Number.parseFloat(property.priceDelta) : null;
  const deltaTone =
    deltaNum != null && Number.isFinite(deltaNum)
      ? deltaNum > 1
        ? "text-warning"
        : deltaNum < -1
          ? "text-sky-600"
          : "text-foreground/70"
      : "text-foreground/70";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-pragma-soft transition-colors",
        open && "ring-2 ring-pragma-electric/25",
        property.syncStatus === "ERROR" && "border-destructive/40",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-4 px-4 py-3.5 text-left hover:bg-muted/20"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PropertyIdentity
              name={property.name}
              unitNumber={property.unitNumber}
              listingName={insights.listingName}
              size="sm"
            />
            <Badge variant="outline" className={cn("text-xs", syncBadge(property.syncStatus))}>
              {syncStatusLabel(property.syncStatus)}
            </Badge>
            {!property.listingId ? (
              <Badge variant="outline" className={cn("text-xs", getSemanticBadgeClass("warning"))}>
                Sin mapeo
              </Badge>
            ) : null}
            {insights.overrideCount > 0 ? (
              <Badge variant="outline" className="text-xs">
                {insights.overrideCount} DSO
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
            <BoundStat label="Mín" value={formatPriceLabsMoney(property.minRate)} />
            <BoundStat label="Base" value={formatPriceLabsMoney(property.baseRate)} />
            <BoundStat label="Máx" value={formatPriceLabsMoney(property.maxRate)} />
            <BoundStat
              label="Recomendado"
              value={formatPriceLabsMoney(property.recommendedRate)}
              highlight
            />
            <BoundStat
              label="Δ vs base"
              value={formatPriceDelta(property.priceDelta)}
              tone={deltaTone}
            />
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-2 h-5 w-5 shrink-0 text-foreground/70 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-border/60 px-4 py-4">
          {property.lastError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {property.lastError}
            </p>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">
                Límites de precio
              </h4>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 px-3 text-sm font-semibold"
                  disabled={pending || !property.listingId}
                  onClick={() =>
                    run(() =>
                      savePropertyPriceBoundsAction({
                        propertyId: property.id,
                        minRate,
                        baseRate,
                        maxRate,
                      }),
                    )
                  }
                >
                  <Save className="h-4 w-4" />
                  Guardar y sincronizar
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["Mínimo", minRate, setMinRate],
                  ["Base", baseRate, setBaseRate],
                  ["Máximo", maxRate, setMaxRate],
                ] as const
              ).map(([label, value, onChange]) => (
                <div key={label}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  {canManage ? (
                    <Input
                      inputMode="numeric"
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="h-10 px-3 text-center text-base font-semibold tabular-nums"
                      disabled={pending}
                    />
                  ) : (
                    <p className="text-base font-semibold tabular-nums">
                      {formatPriceLabsMoney(value || null)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-foreground/70">
              {property.revenue ? (
                <span>Ingreso PL: {formatPriceLabsMoney(property.revenue)}</span>
              ) : null}
              {insights.minStayToday != null ? (
                <span>Min stay hoy: {insights.minStayToday}n</span>
              ) : null}
              {insights.maxMinStayNext14 != null ? (
                <span>Max min 14d: {insights.maxMinStayNext14}n</span>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
              Calendario · próximos 14 días
            </h4>
            {insights.hasDailyPrices ? (
              <div className="grid grid-cols-7 gap-1">
                {insights.next14Days.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded border px-1 py-1.5 text-center text-[10px]",
                      day.hasOverride && "border-pragma-cyan/40 bg-pragma-soft-cyan/20",
                      !day.hasOverride && demandLevelClass(day.demandLevel),
                    )}
                    title={day.pricingReason ?? day.demandLevel ?? undefined}
                  >
                    <p className="font-medium">{formatShortDate(day.date)}</p>
                    <p className="mt-0.5 tabular-nums text-success">
                      {formatPriceLabsMoney(day.recommended)}
                    </p>
                    {day.minStay != null && day.minStay > 1 ? (
                      <p className="text-[9px] text-foreground/70">{day.minStay}n</p>
                    ) : null}
                    {day.hasOverride ? (
                      <p className="text-[9px] font-medium text-pragma-electric">DSO</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-foreground/70">
                Sin precios diarios. Ejecuta «Sync precios».
              </p>
            )}
            {insights.pricingReasonSample ? (
              <p className="text-[11px] text-foreground/70">
                Motivo PL: {insights.pricingReasonSample}
              </p>
            ) : null}
            {insights.ratePlanHints.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {insights.ratePlanHints.map((hint) => (
                  <Badge key={hint} variant="outline" className="text-[10px]">
                    {hint}
                  </Badge>
                ))}
              </div>
            ) : null}
          </section>

          {property.listingId && canManage ? (
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Override / DSO
              </h4>
              <div className="grid gap-2 sm:grid-cols-5">
                <Input
                  type="date"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="h-8 text-xs sm:col-span-2"
                  disabled={pending}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Precio"
                  value={overridePrice}
                  onChange={(e) => setOverridePrice(e.target.value)}
                  className="h-8 text-xs"
                  disabled={pending}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Min noches"
                  value={overrideMinStay}
                  onChange={(e) => setOverrideMinStay(e.target.value)}
                  className="h-8 text-xs"
                  disabled={pending}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Min $"
                  value={overrideMinPrice}
                  onChange={(e) => setOverrideMinPrice(e.target.value)}
                  className="h-8 text-xs"
                  disabled={pending}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Máx $"
                  value={overrideMaxPrice}
                  onChange={(e) => setOverrideMaxPrice(e.target.value)}
                  className="h-8 text-xs"
                  disabled={pending}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={pending || !overrideDate}
                onClick={() =>
                  run(() =>
                    savePriceLabsOverrideAction({
                      propertyId: property.id,
                      date: overrideDate,
                      price: overridePrice,
                      minStay: overrideMinStay,
                      minPrice: overrideMinPrice,
                      maxPrice: overrideMaxPrice,
                    }),
                  )
                }
              >
                Guardar override
              </Button>
              {insights.upcomingOverrides.length > 0 ? (
                <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70">
                  {insights.upcomingOverrides.map((row) => (
                    <li
                      key={row.date}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs"
                    >
                      <span className="font-medium">{formatShortDate(row.date)}</span>
                      <span className="text-foreground/70">
                        {row.price != null ? formatPriceLabsMoney(row.price) : "—"}
                        {row.minStay != null ? ` · ${row.minStay}n` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            deletePriceLabsOverridesAction({
                              propertyId: property.id,
                              dates: [row.date],
                            }),
                          )
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-foreground/70">Sin overrides próximos.</p>
              )}
            </section>
          ) : null}

          <section className="space-y-1 border-t border-border/60 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                Listing & sync
              </h4>
              {canManage && property.listingId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={pending}
                  onClick={() =>
                    run(() => syncSinglePriceLabsListingAction(property.id))
                  }
                >
                  {pending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Re-sync listing
                </Button>
              ) : null}
            </div>
            <MetaRow
              label="Listing ID"
              value={property.listingId ? `…${property.listingId.slice(-10)}` : "Sin mapeo"}
            />
            <MetaRow label="PMS" value={insights.listingPms} />
            <MetaRow label="Match" value={matchReasonLabel(insights.matchReason)} />
            <MetaRow label="Fuente" value={insights.pricingSource} />
            <MetaRow label="Sync precios" value={formatPriceLabsDate(insights.lastPricesSync)} />
            <MetaRow label="Sync overrides" value={formatPriceLabsDate(insights.lastOverridesSync)} />
            <MetaRow label="Última sync" value={formatPriceLabsDate(property.lastSyncedAt)} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function BoundStat({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums sm:text-base",
          highlight && "text-success",
          tone,
        )}
      >
        {value}
      </p>
    </div>
  );
}
