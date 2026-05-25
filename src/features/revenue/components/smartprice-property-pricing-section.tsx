"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { savePropertyPriceBoundsAction } from "@/features/revenue/actions/smartprice.actions";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { sortPropertiesByUnitNumber } from "@/lib/property-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

type PropertyRow = PriceLabsOverviewDto["properties"][number];

type SmartpricePropertyPricingSectionProps = {
  properties: PropertyRow[];
  canEditPrices: boolean;
  billingLocked: boolean;
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

function resolveUnitNumber(property: PropertyRow): string {
  const unitLabel = resolveCalendarUnitLabel({
    name: property.name,
    unitNumber: property.unitNumber,
    listingName: property.insights.listingName,
  });
  return unitLabel ? formatCalendarUnitDisplay(unitLabel) : "—";
}

function PropertyPricingRow({
  property,
  canEdit,
}: {
  property: PropertyRow;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [minRate, setMinRate] = useState(property.minRate ?? "");
  const [baseRate, setBaseRate] = useState(property.baseRate ?? "");
  const [maxRate, setMaxRate] = useState(property.maxRate ?? "");
  const unitNumber = resolveUnitNumber(property);

  const onSave = () => {
    startTransition(async () => {
      try {
        const result = await savePropertyPriceBoundsAction({
          propertyId: property.id,
          minRate,
          baseRate,
          maxRate,
        });
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  };

const cellClass = "px-1.5 py-1 text-center";

  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className={cellClass}>
        <p
          className="text-sm font-normal tabular-nums text-black"
          title={property.name}
        >
          {unitNumber}
        </p>
      </td>
      <td className={cellClass}>
        <RateCell
          value={minRate}
          display={formatMoney(property.minRate)}
          onChange={setMinRate}
          canEdit={canEdit}
          pending={pending}
        />
      </td>
      <td className={cellClass}>
        <RateCell
          value={baseRate}
          display={formatMoney(property.baseRate)}
          onChange={setBaseRate}
          canEdit={canEdit}
          pending={pending}
        />
      </td>
      <td className={cellClass}>
        <RateCell
          value={maxRate}
          display={formatMoney(property.maxRate)}
          onChange={setMaxRate}
          canEdit={canEdit}
          pending={pending}
        />
      </td>
      <td className={cellClass}>
        <p className="text-sm tabular-nums text-success">
          {formatMoney(property.recommendedRate)}
        </p>
      </td>
      {canEdit ? (
        <td className={cellClass}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onSave}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Save className="h-3 w-3" />
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
}: {
  value: string;
  display: string;
  onChange: (value: string) => void;
  canEdit: boolean;
  pending: boolean;
}) {
  if (canEdit) {
    return (
      <Input
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        className="mx-auto h-7 w-full max-w-[5rem] px-1.5 text-center text-sm tabular-nums"
        disabled={pending}
      />
    );
  }

  return <p className="text-sm tabular-nums">{display}</p>;
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
    <Card>
      <CardHeader className="pb-2 text-center">
        <CardTitle className="text-base">{t("smartprice.pricing.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("smartprice.pricing.description")}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {sortedProperties.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("smartprice.pricing.empty")}
          </p>
        ) : (
          <div className="mx-auto overflow-x-auto rounded-xl border border-border/70">
            <table className="mx-auto w-full min-w-[440px] max-w-2xl border-separate border-spacing-0 text-center text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="border-b border-border px-1.5 py-1 font-medium text-black">
                    {t("smartprice.pricing.unit")}
                  </th>
                  <th className="border-b border-border px-1.5 py-1 font-medium">{t("smartprice.pricing.min")}</th>
                  <th className="border-b border-border px-1.5 py-1 font-medium">{t("smartprice.pricing.base")}</th>
                  <th className="border-b border-border px-1.5 py-1 font-medium">{t("smartprice.pricing.max")}</th>
                  <th className="border-b border-border px-1.5 py-1 font-medium">{t("smartprice.pricing.recommended")}</th>
                  {canEdit ? <th className="border-b border-border px-1.5 py-1 font-medium" /> : null}
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
