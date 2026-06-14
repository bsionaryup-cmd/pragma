"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { savePropertyPriceBoundsAction } from "@/features/revenue/actions/smartprice.actions";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import {
  formatPriceDelta,
  formatPriceLabsMoney,
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

type SmartpricePropertyPricingSectionProps = {
  properties: PropertyRow[];
  canEditPrices: boolean;
  billingLocked: boolean;
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

function PropertyPricingRow({
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
  const [minRate, setMinRate] = useState(property.minRate ?? "");
  const [baseRate, setBaseRate] = useState(property.baseRate ?? "");
  const [maxRate, setMaxRate] = useState(property.maxRate ?? "");
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

  const onSave = () => {
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
    <tr
      className={cn(
        "border-b border-border/60 transition-colors last:border-0",
        property.syncStatus === "ERROR" && "bg-destructive/5",
        !property.listingId && "bg-warning/5",
      )}
    >
      <td className={cellClass}>
        <div className="min-w-[7rem]">
          <p className="text-base font-bold tabular-nums text-foreground">{unitNumber}</p>
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
          </div>
        </div>
      </td>
      <td className={cellClass}>
        <RateCell
          value={minRate}
          display={formatPriceLabsMoney(property.minRate)}
          onChange={setMinRate}
          canEdit={canEdit}
          pending={pending}
          label={t("smartprice.pricing.min")}
        />
      </td>
      <td className={cellClass}>
        <RateCell
          value={baseRate}
          display={formatPriceLabsMoney(property.baseRate)}
          onChange={setBaseRate}
          canEdit={canEdit}
          pending={pending}
          label={t("smartprice.pricing.base")}
        />
      </td>
      <td className={cellClass}>
        <RateCell
          value={maxRate}
          display={formatPriceLabsMoney(property.maxRate)}
          onChange={setMaxRate}
          canEdit={canEdit}
          pending={pending}
          label={t("smartprice.pricing.max")}
        />
      </td>
      <td className={cellClass}>
        <p className="text-base font-semibold tabular-nums text-success">
          {formatPriceLabsMoney(property.recommendedRate)}
        </p>
        <p className="text-[11px] text-muted-foreground">{t("smartprice.pricing.recommended")}</p>
      </td>
      <td className={cellClass}>
        <p className={cn("text-base font-semibold tabular-nums", deltaTone)}>
          {formatPriceDelta(property.priceDelta)}
        </p>
        <p className="text-[11px] text-muted-foreground">vs base</p>
      </td>
      {canEdit ? (
        <td className={cellClass}>
          <Button
            type="button"
            size="sm"
            disabled={pending || !property.listingId}
            onClick={onSave}
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
  );
}

function RateCell({
  value,
  display,
  onChange,
  canEdit,
  pending,
  label,
}: {
  value: string;
  display: string;
  onChange: (value: string) => void;
  canEdit: boolean;
  pending: boolean;
  label: string;
}) {
  if (canEdit) {
    return (
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Input
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          aria-label={label}
          className="h-10 w-full min-w-[5.5rem] max-w-[7rem] border-border/80 bg-background px-3 text-center text-base font-semibold tabular-nums shadow-sm"
          disabled={pending}
        />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums">{display}</p>
    </div>
  );
}

export function SmartpricePropertyPricingSection({
  properties,
  canEditPrices,
  billingLocked,
}: SmartpricePropertyPricingSectionProps) {
  const { t } = useI18n();
  const canEdit = canEditPrices && !billingLocked;

  const sortedProperties = useMemo(
    () =>
      sortPropertiesByUnitNumber(properties, (property) => ({
        name: property.name,
        unitNumber: resolveCalendarUnitLabel({
          name: property.name,
          unitNumber: property.unitNumber,
          listingName: property.insights.listingName,
        }),
      })),
    [properties],
  );

  return (
    <Card className="border-border/80 shadow-pragma-soft">
      <CardHeader className="border-b border-border/60 bg-muted/15 pb-4">
        <CardTitle className="text-lg font-semibold">{t("smartprice.pricing.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("smartprice.pricing.description")}</p>
      </CardHeader>
      <CardContent className="p-0">
        {sortedProperties.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("smartprice.pricing.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-muted/25 text-xs font-semibold uppercase tracking-wide text-foreground">
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.unit")}</th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.min")}</th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.base")}</th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.max")}</th>
                  <th className="border-b border-border px-3 py-3">{t("smartprice.pricing.recommended")}</th>
                  <th className="border-b border-border px-3 py-3">Δ</th>
                  {canEdit ? <th className="border-b border-border px-3 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {sortedProperties.map((property) => (
                  <PropertyPricingRow
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
