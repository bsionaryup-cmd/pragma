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
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

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

function PropertyPricingCard({
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

  const unitLabel = resolveCalendarUnitLabel({
    name: property.name,
    unitNumber: property.unitNumber,
  });
  const unitDisplay = unitLabel ? formatCalendarUnitDisplay(unitLabel) : null;

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

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-pragma-soft">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {unitDisplay ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-pragma-electric">
              {t("smartprice.pricing.unit")} {unitDisplay}
            </p>
          ) : null}
          <p
            className={cn(
              "truncate font-medium text-foreground",
              unitDisplay ? "mt-0.5 text-sm" : "text-base",
            )}
            title={property.name}
          >
            {property.name}
          </p>
          {property.city ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{property.city}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("smartprice.pricing.recommended")}
          </p>
          <p className="text-sm font-semibold tabular-nums text-success">
            {formatMoney(property.recommendedRate)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <RateField
          label={t("smartprice.pricing.min")}
          value={minRate}
          onChange={setMinRate}
          display={formatMoney(property.minRate)}
          canEdit={canEdit}
          pending={pending}
        />
        <RateField
          label={t("smartprice.pricing.base")}
          value={baseRate}
          onChange={setBaseRate}
          display={formatMoney(property.baseRate)}
          canEdit={canEdit}
          pending={pending}
        />
        <RateField
          label={t("smartprice.pricing.max")}
          value={maxRate}
          onChange={setMaxRate}
          display={formatMoney(property.maxRate)}
          canEdit={canEdit}
          pending={pending}
        />
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span>
          {t("smartprice.insight.avgDelta")}:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatMoney(property.priceDelta)}
          </span>
        </span>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onSave}
            className="h-8 gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {t("common.save")}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

function RateField({
  label,
  value,
  onChange,
  display,
  canEdit,
  pending,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  display: string;
  canEdit: boolean;
  pending: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {canEdit ? (
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-9 tabular-nums text-sm"
          disabled={pending}
        />
      ) : (
        <p className="py-1.5 text-sm tabular-nums">{display}</p>
      )}
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
        unitNumber: property.unitNumber,
      })),
    [properties],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("smartprice.pricing.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("smartprice.pricing.description")}
        </p>
      </CardHeader>
      <CardContent>
        {sortedProperties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("smartprice.pricing.empty")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedProperties.map((property) => (
              <PropertyPricingCard
                key={property.id}
                property={property}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
