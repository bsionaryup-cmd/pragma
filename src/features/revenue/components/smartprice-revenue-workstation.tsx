"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
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
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import {
  demandLevelClass,
  formatPriceDelta,
  formatPriceLabsMoney,
  formatShortDate,
  syncStatusLabel,
} from "@/features/integrations/pricelabs/lib/pricelabs-format";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { sortPropertiesByUnitNumber } from "@/lib/property-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

type PropertyRow = PriceLabsOverviewDto["properties"][number];

type SmartpriceRevenueWorkstationProps = {
  properties: PropertyRow[];
  canEditPrices: boolean;
  billingLocked: boolean;
  reviewPropertyIds: string[];
};

function syncBadgeClass(status: PropertyRow["syncStatus"]) {
  switch (status) {
    case "SYNCED":
      return getSemanticBadgeClass("success");
    case "ERROR":
      return getSemanticBadgeClass("warning");
    default:
      return getSemanticBadgeClass("neutral");
  }
}

function resolveUnitNumber(property: PropertyRow): string {
  const unitLabel = resolveCalendarUnitLabel({
    name: property.name,
    unitNumber: property.unitNumber,
    listingName: property.insights.listingName,
  });
  return unitLabel ? formatCalendarUnitDisplay(unitLabel) : property.name;
}

function PropertyWorkstationRow({
  property,
  canEdit,
  defaultExpanded,
}: {
  property: PropertyRow;
  canEdit: boolean;
  defaultExpanded: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [minRate, setMinRate] = useState(property.minRate ?? "");
  const [baseRate, setBaseRate] = useState(property.baseRate ?? "");
  const [maxRate, setMaxRate] = useState(property.maxRate ?? "");
  const [overrideDate, setOverrideDate] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideMinStay, setOverrideMinStay] = useState("");
  const [overrideMinPrice, setOverrideMinPrice] = useState("");
  const [overrideMaxPrice, setOverrideMaxPrice] = useState("");
  const { insights } = property;
  const unitNumber = resolveUnitNumber(property);

  const deltaNum =
    property.priceDelta != null ? Number.parseFloat(property.priceDelta) : null;
  const deltaTone =
    deltaNum != null && Number.isFinite(deltaNum)
      ? deltaNum > 1
        ? "text-warning"
        : deltaNum < -1
          ? "text-sky-700"
          : "text-foreground/80"
      : "text-foreground/70";

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

  const onSaveBounds = () => {
    startTransition(async () => {
      setSaved(false);
      try {
        const result = await savePropertyPriceBoundsAction({
          propertyId: property.id,
          minRate,
          baseRate,
          maxRate,
        });
        if (result.ok) {
          toast.success(result.message);
          setSaved(true);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  };

  const cellClass = "px-3 py-3 align-middle";

  return (
    <Fragment>
      <tr
        className={cn(
          "border-b border-border/60 transition-colors",
          property.syncStatus === "ERROR" && "bg-destructive/5",
          !property.listingId && "bg-warning/5",
          expanded && "bg-muted/10",
        )}
      >
        <td className={cn(cellClass, "w-10")}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1 hover:bg-muted/40"
            aria-label={expanded ? "Ocultar detalle" : "Ver calendario y overrides"}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition", expanded && "rotate-180")}
            />
          </button>
        </td>
        <td className={cellClass}>
          <div className="min-w-[7rem]">
            <p className="text-base font-bold tabular-nums">{unitNumber}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{property.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge variant="outline" className={cn("text-[11px]", syncBadgeClass(property.syncStatus))}>
                {syncStatusLabel(property.syncStatus)}
              </Badge>
              {!property.listingId ? (
                <Badge variant="outline" className={cn("text-[11px]", getSemanticBadgeClass("warning"))}>
                  Sin mapeo
                </Badge>
              ) : null}
              {insights.overrideCount > 0 ? (
                <Badge variant="outline" className="text-[11px]">
                  {insights.overrideCount} DSO
                </Badge>
              ) : null}
              {insights.maxMinStayNext14 != null && insights.maxMinStayNext14 >= 3 ? (
                <Badge variant="outline" className="text-[11px] text-warning">
                  Min {insights.maxMinStayNext14}n
                </Badge>
              ) : null}
            </div>
            {property.lastError ? (
              <p className="mt-1 text-xs text-destructive">{property.lastError}</p>
            ) : null}
          </div>
        </td>
        <td className={cellClass}>
          <RateInput value={minRate} onChange={setMinRate} canEdit={canEdit} pending={pending} />
        </td>
        <td className={cellClass}>
          <RateInput value={baseRate} onChange={setBaseRate} canEdit={canEdit} pending={pending} />
        </td>
        <td className={cellClass}>
          <RateInput
            value={maxRate}
            onChange={setMaxRate}
            canEdit={canEdit}
            pending={pending}
            optional
          />
        </td>
        <td className={cellClass}>
          <p className="text-base font-semibold tabular-nums text-success">
            {formatPriceLabsMoney(property.recommendedRate)}
          </p>
        </td>
        <td className={cellClass}>
          <p className={cn("text-base font-semibold tabular-nums", deltaTone)}>
            {formatPriceDelta(property.priceDelta)}
          </p>
        </td>
        {canEdit ? (
          <td className={cellClass}>
            <Button
              type="button"
              size="sm"
              disabled={pending || !property.listingId}
              onClick={onSaveBounds}
              className="h-9 min-w-[5.5rem] gap-1.5 px-3 text-sm font-semibold"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("common.save")}
            </Button>
          </td>
        ) : null}
      </tr>

      {expanded ? (
        <tr className="border-b border-border/60 bg-muted/5">
          <td colSpan={canEdit ? 8 : 7} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Calendario · 14 días</h4>
                {insights.hasDailyPrices ? (
                  <div className="grid grid-cols-7 gap-1.5">
                    {insights.next14Days.map((day) => (
                      <div
                        key={day.date}
                        className={cn(
                          "rounded-md border px-1.5 py-2 text-center text-xs",
                          day.hasOverride && "border-pragma-cyan/40 bg-pragma-soft-cyan/20",
                          !day.hasOverride && demandLevelClass(day.demandLevel),
                        )}
                        title={day.pricingReason ?? day.demandLevel ?? undefined}
                      >
                        <p className="font-medium">{formatShortDate(day.date)}</p>
                        <p className="mt-0.5 tabular-nums font-semibold text-success">
                          {formatPriceLabsMoney(day.recommended)}
                        </p>
                        {day.minStay != null && day.minStay > 1 ? (
                          <p className="text-[10px] text-muted-foreground">{day.minStay}n</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin precios diarios sincronizados. Usa Integraciones → Sync precios.
                  </p>
                )}
              </section>

              {property.listingId && canEdit ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">Override / DSO</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      disabled={pending}
                      onClick={() => run(() => syncSinglePriceLabsListingAction(property.id))}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Re-sync
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    <Input
                      type="date"
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      className="h-9 text-sm sm:col-span-2"
                      disabled={pending}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Precio"
                      value={overridePrice}
                      onChange={(e) => setOverridePrice(e.target.value)}
                      className="h-9 text-sm"
                      disabled={pending}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Min noches"
                      value={overrideMinStay}
                      onChange={(e) => setOverrideMinStay(e.target.value)}
                      className="h-9 text-sm"
                      disabled={pending}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Min $"
                      value={overrideMinPrice}
                      onChange={(e) => setOverrideMinPrice(e.target.value)}
                      className="h-9 text-sm"
                      disabled={pending}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
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
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border">
                      {insights.upcomingOverrides.map((row) => (
                        <li
                          key={row.date}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{formatShortDate(row.date)}</span>
                          <span className="text-muted-foreground">
                            {row.price != null ? formatPriceLabsMoney(row.price) : "—"}
                            {row.minStay != null ? ` · ${row.minStay}n` : ""}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive"
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
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin overrides próximos.</p>
                  )}
                </section>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function RateInput({
  value,
  onChange,
  canEdit,
  pending,
  optional = false,
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  pending: boolean;
  optional?: boolean;
}) {
  if (!canEdit) {
    return (
      <p className="text-base font-semibold tabular-nums">
        {value ? formatPriceLabsMoney(value) : "—"}
      </p>
    );
  }
  return (
    <Input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={optional ? "Opcional" : "0"}
      className="h-10 w-full min-w-[5.5rem] max-w-[7rem] px-3 text-center text-base font-semibold tabular-nums"
      disabled={pending}
    />
  );
}

export function SmartpriceRevenueWorkstation({
  properties,
  canEditPrices,
  billingLocked,
  reviewPropertyIds,
}: SmartpriceRevenueWorkstationProps) {
  const { t } = useI18n();
  const canEdit = canEditPrices && !billingLocked;
  const review = useMemo(() => new Set(reviewPropertyIds), [reviewPropertyIds]);

  const sortedProperties = useMemo(
    () =>
      sortPropertiesByUnitNumber(properties, (property) => ({
        name: property.name,
        unitNumber: resolveCalendarUnitLabel({
          name: property.name,
          unitNumber: property.unitNumber,
          listingName: property.insights.listingName,
        }),
      })).sort((a, b) => {
        const aReview = review.has(a.id) ? 0 : 1;
        const bReview = review.has(b.id) ? 0 : 1;
        if (aReview !== bReview) return aReview - bReview;
        return 0;
      }),
    [properties, review],
  );

  const defaultExpandedId =
    reviewPropertyIds[0] ?? properties.find((p) => !p.listingId)?.id ?? null;

  return (
    <Card className="border-border/80 shadow-pragma-soft">
      <CardHeader className="border-b border-border/60 bg-muted/15 pb-4">
        <CardTitle className="text-lg font-semibold">{t("smartprice.pricing.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Edita límites, guarda y sincroniza con PriceLabs. Expande una fila para calendario y overrides.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {sortedProperties.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("smartprice.pricing.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-muted/25 text-xs font-semibold uppercase tracking-wide text-foreground">
                  <th className="border-b border-border px-3 py-3 w-10" />
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.unit")}</th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.min")}</th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.base")}</th>
                  <th className="border-b border-border px-3 py-3">
                    {t("smartprice.pricing.max")} <span className="font-normal normal-case text-muted-foreground">(opc.)</span>
                  </th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.recommended")}</th>
                  <th className="border-b border-border px-3 py-3">Δ</th>
                  {canEdit ? <th className="border-b border-border px-3 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {sortedProperties.map((property) => (
                  <PropertyWorkstationRow
                    key={property.id}
                    property={property}
                    canEdit={canEdit}
                    defaultExpanded={property.id === defaultExpandedId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
