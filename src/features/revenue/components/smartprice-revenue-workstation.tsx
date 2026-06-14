"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import {
  isRevenuePropertyAnomaly,
  parsePropertyDelta,
  propertyMatchesSearch,
} from "@/features/revenue/lib/revenue-property-anomaly";
import {
  formatMinStayLabel,
  resolveRevenueDisplayPrice,
  type CalendarDayPreview,
} from "@/features/revenue/lib/revenue-display-pricing";
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
  searchQuery?: string;
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
}: {
  property: PropertyRow;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minRate, setMinRate] = useState(property.minRate ?? "");
  const [baseRate, setBaseRate] = useState(property.baseRate ?? "");
  const [maxRate, setMaxRate] = useState(property.maxRate ?? "");
  const [overrideDate, setOverrideDate] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideMinStay, setOverrideMinStay] = useState("");
  const [overrideMinPrice, setOverrideMinPrice] = useState("");
  const [overrideMaxPrice, setOverrideMaxPrice] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { insights } = property;
  const unitNumber = resolveUnitNumber(property);
  const displayPrice = useMemo(
    () => resolveRevenueDisplayPrice(property),
    [property],
  );

  const applyDayToAdjustment = (day: CalendarDayPreview) => {
    setSelectedDay(day.date);
    setOverrideDate(day.date);
    if (day.recommended != null) {
      setOverridePrice(String(Math.round(day.recommended)));
    }
    if (day.minStay != null && day.minStay > 0) {
      setOverrideMinStay(String(day.minStay));
    }
  };

  useEffect(() => {
    setMinRate(property.minRate ?? "");
    setBaseRate(property.baseRate ?? "");
    setMaxRate(property.maxRate ?? "");
    setSaved(false);
  }, [property.id, property.minRate, property.baseRate, property.maxRate]);

  const deltaNum = displayPrice.delta;
  const deltaTone =
    deltaNum != null && Number.isFinite(deltaNum)
      ? deltaNum > 1
        ? "text-warning"
        : deltaNum < -1
          ? "text-sky-700"
          : "text-foreground/80"
      : "text-foreground/70";

  const displayDelta =
    deltaNum != null && Number.isFinite(deltaNum)
      ? formatPriceDelta(String(deltaNum))
      : formatPriceDelta(property.priceDelta);

  const displayRecommended =
    displayPrice.recommended != null
      ? formatPriceLabsMoney(String(displayPrice.recommended))
      : formatPriceLabsMoney(property.recommendedRate);

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
            aria-label={expanded ? "Ocultar detalle" : "Ver calendario y ajustes por fecha"}
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
              {property.syncStatus !== "SYNCED" ? (
                <Badge variant="outline" className={cn("text-[11px]", syncBadgeClass(property.syncStatus))}>
                  {syncStatusLabel(property.syncStatus)}
                </Badge>
              ) : null}
              {!property.listingId ? (
                <Badge variant="outline" className={cn("text-[11px]", getSemanticBadgeClass("warning"))}>
                  Sin mapeo
                </Badge>
              ) : null}
              {insights.overrideCount > 0 ? (
                <Badge variant="outline" className="text-[11px]">
                  {t("smartprice.pricing.badgeAdjustments", {
                    count: insights.overrideCount,
                  })}
                </Badge>
              ) : null}
              {insights.minStayToday != null && insights.minStayToday > 1 ? (
                <Badge
                  variant="outline"
                  className="border-pragma-electric/40 bg-pragma-soft-cyan/25 text-[11px] font-semibold text-pragma-electric"
                >
                  {t("smartprice.pricing.badgeMinStayToday", {
                    count: insights.minStayToday,
                  })}
                </Badge>
              ) : null}
              {insights.maxMinStayNext14 != null && insights.maxMinStayNext14 >= 3 ? (
                <Badge variant="outline" className="text-[11px] text-warning">
                  {t("smartprice.pricing.badgeMinStay", {
                    count: insights.maxMinStayNext14,
                  })}
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
          <div>
            <p className="text-base font-semibold tabular-nums text-success">
              {displayRecommended}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {displayPrice.dateLabel
                ? `${displayPrice.dateLabel} · ${t("smartprice.pricing.recommendedHint")}`
                : t("smartprice.pricing.recommendedHint")}
            </p>
          </div>
        </td>
        <td className={cellClass}>
          <div>
            <p className={cn("text-base font-semibold tabular-nums", deltaTone)}>
              {displayDelta}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {t("smartprice.pricing.differenceHint")}
            </p>
          </div>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t("smartprice.pricing.calendarTitle")}
                  </h4>
                  <Link
                    href="/calendar"
                    className="text-xs font-semibold text-pragma-electric hover:underline"
                  >
                    {t("smartprice.pricing.calendarFullLink")}
                  </Link>
                </div>
                {canEdit && property.listingId ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t("smartprice.pricing.calendarDayHint")}
                  </p>
                ) : null}
                {insights.hasDailyPrices ? (
                  <div className="grid grid-cols-7 gap-1.5">
                    {insights.next14Days.slice(0, 7).map((day) => {
                      const minLabel = formatMinStayLabel(day.minStay);
                      const elevatedMin = day.minStay != null && day.minStay > 1;
                      const isSelected = selectedDay === day.date;
                      const cellClassName = cn(
                        "rounded-lg border px-1.5 py-2 text-center text-xs transition-colors",
                        day.hasOverride &&
                          "border-pragma-cyan/50 bg-pragma-soft-cyan/30 ring-1 ring-pragma-cyan/20",
                        !day.hasOverride && demandLevelClass(day.demandLevel),
                        elevatedMin &&
                          !day.hasOverride &&
                          "border-pragma-electric/35 bg-pragma-soft-cyan/15",
                        isSelected && "ring-2 ring-pragma-electric",
                        canEdit &&
                          property.listingId &&
                          "cursor-pointer hover:border-pragma-electric/60 hover:bg-pragma-soft-cyan/25",
                      );
                      const inner = (
                        <>
                          <p className="font-medium">{formatShortDate(day.date)}</p>
                          <p className="mt-0.5 tabular-nums font-semibold text-success">
                            {formatPriceLabsMoney(
                              day.recommended != null ? String(day.recommended) : null,
                            )}
                          </p>
                          {minLabel ? (
                            <p
                              className={cn(
                                "mt-1 rounded-full px-1 py-0.5 text-[10px] font-semibold leading-tight",
                                elevatedMin
                                  ? "bg-pragma-electric/10 text-pragma-electric"
                                  : "text-muted-foreground",
                              )}
                            >
                              {minLabel}
                            </p>
                          ) : null}
                        </>
                      );
                      return canEdit && property.listingId ? (
                        <button
                          key={day.date}
                          type="button"
                          className={cellClassName}
                          title={day.pricingReason ?? day.demandLevel ?? undefined}
                          onClick={() => applyDayToAdjustment(day)}
                        >
                          {inner}
                        </button>
                      ) : (
                        <div
                          key={day.date}
                          className={cellClassName}
                          title={day.pricingReason ?? day.demandLevel ?? undefined}
                        >
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("smartprice.pricing.calendarEmpty")}
                  </p>
                )}
              </section>

              {property.listingId && canEdit ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t("smartprice.pricing.adjustmentsTitle")}
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      disabled={pending}
                      onClick={() => run(() => syncSinglePriceLabsListingAction(property.id))}
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t("smartprice.pricing.refreshListing")}
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("smartprice.pricing.fields.date")}
                      </label>
                      <Input
                        type="date"
                        value={overrideDate}
                        onChange={(e) => {
                          setOverrideDate(e.target.value);
                          setSelectedDay(e.target.value || null);
                        }}
                        className="h-9 text-sm"
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("smartprice.pricing.fields.price")}
                      </label>
                      <Input
                        inputMode="numeric"
                        placeholder="0"
                        value={overridePrice}
                        onChange={(e) => setOverridePrice(e.target.value)}
                        className="h-9 text-sm"
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("smartprice.pricing.fields.minNights")}
                      </label>
                      <Input
                        inputMode="numeric"
                        placeholder="1"
                        value={overrideMinStay}
                        onChange={(e) => setOverrideMinStay(e.target.value)}
                        className="h-9 text-sm"
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("smartprice.pricing.fields.minPrice")}
                      </label>
                      <Input
                        inputMode="numeric"
                        placeholder="0"
                        value={overrideMinPrice}
                        onChange={(e) => setOverrideMinPrice(e.target.value)}
                        className="h-9 text-sm"
                        disabled={pending}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("smartprice.pricing.fields.maxPrice")}
                      </label>
                      <Input
                        inputMode="numeric"
                        placeholder="0"
                        value={overrideMaxPrice}
                        onChange={(e) => setOverrideMaxPrice(e.target.value)}
                        className="h-9 text-sm"
                        disabled={pending}
                      />
                    </div>
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
                    {t("smartprice.pricing.saveAdjustment")}
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
                            {row.price != null ? formatPriceLabsMoney(String(row.price)) : "—"}
                            {row.minStay != null
                              ? ` · ${formatMinStayLabel(row.minStay) ?? ""}`
                              : ""}
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
                    <p className="text-sm text-muted-foreground">
                      {t("smartprice.pricing.adjustmentsEmpty")}
                    </p>
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
  searchQuery = "",
}: SmartpriceRevenueWorkstationProps) {
  const { t } = useI18n();
  const canEdit = canEditPrices && !billingLocked;
  const [anomaliesOnly, setAnomaliesOnly] = useState(true);

  const visibleProperties = useMemo(() => {
    let list = properties;
    if (anomaliesOnly) {
      list = list.filter(isRevenuePropertyAnomaly);
    }
    const q = searchQuery.trim();
    if (q) {
      list = list.filter((property) => propertyMatchesSearch(property, q));
    }
    return [...list].sort((a, b) => {
      const aDelta = Math.abs(parsePropertyDelta(a) ?? 0);
      const bDelta = Math.abs(parsePropertyDelta(b) ?? 0);
      if (bDelta !== aDelta) return bDelta - aDelta;
      const sorted = sortPropertiesByUnitNumber([a, b], (property) => ({
        name: property.name,
        unitNumber: resolveCalendarUnitLabel({
          name: property.name,
          unitNumber: property.unitNumber,
          listingName: property.insights.listingName,
        }),
      }));
      return sorted[0].id === a.id ? -1 : 1;
    });
  }, [properties, anomaliesOnly, searchQuery]);

  return (
    <Card className="border-border/80 shadow-pragma-soft">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-muted/15 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg font-semibold">{t("smartprice.pricing.title")}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("smartprice.pricing.anomaliesOnly")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={anomaliesOnly}
            aria-label={t("smartprice.pricing.anomaliesOnly")}
            onClick={() => setAnomaliesOnly((v) => !v)}
            className={cn(
              "relative inline-flex h-[26px] w-[46px] shrink-0 rounded-full transition-colors",
              anomaliesOnly ? "bg-pragma-electric" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "pointer-events-none absolute top-[3px] size-5 rounded-full bg-white shadow-sm transition-transform",
                anomaliesOnly ? "translate-x-[22px]" : "translate-x-[3px]",
              )}
            />
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {visibleProperties.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {anomaliesOnly && !searchQuery.trim()
              ? t("smartprice.pricing.anomaliesEmpty")
              : t("smartprice.pricing.empty")}
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
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.difference")}</th>
                  {canEdit ? <th className="border-b border-border px-3 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {visibleProperties.map((property) => (
                  <PropertyWorkstationRow
                    key={property.id}
                    property={property}
                    canEdit={canEdit}
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
