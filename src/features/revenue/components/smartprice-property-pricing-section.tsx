"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { savePropertyPriceBoundsAction } from "@/features/revenue/actions/smartprice.actions";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
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
    <tr className="border-b border-border/70">
      <td className="py-3 pr-4 align-top">
        <p className="font-medium">{property.name}</p>
        <p className="text-xs text-muted-foreground">{property.city}</p>
      </td>
      <td className="py-3 pr-3 align-top">
        {canEdit ? (
          <Input
            inputMode="numeric"
            value={minRate}
            onChange={(e) => setMinRate(e.target.value)}
            placeholder="0"
            className="h-9 min-w-[88px] tabular-nums"
            disabled={pending}
          />
        ) : (
          <span className="tabular-nums">{formatMoney(property.minRate)}</span>
        )}
      </td>
      <td className="py-3 pr-3 align-top">
        {canEdit ? (
          <Input
            inputMode="numeric"
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
            placeholder="0"
            className="h-9 min-w-[88px] tabular-nums"
            disabled={pending}
          />
        ) : (
          <span className="tabular-nums">{formatMoney(property.baseRate)}</span>
        )}
      </td>
      <td className="py-3 pr-3 align-top">
        {canEdit ? (
          <Input
            inputMode="numeric"
            value={maxRate}
            onChange={(e) => setMaxRate(e.target.value)}
            placeholder="0"
            className="h-9 min-w-[88px] tabular-nums"
            disabled={pending}
          />
        ) : (
          <span className="tabular-nums">{formatMoney(property.maxRate)}</span>
        )}
      </td>
      <td className="py-3 pr-3 align-top tabular-nums text-[#0E9F8D]">
        {formatMoney(property.recommendedRate)}
      </td>
      <td className="py-3 pr-3 align-top tabular-nums">
        {formatMoney(property.priceDelta)}
      </td>
      <td className="py-3 pr-3 align-top tabular-nums text-muted-foreground">
        {property.revenue ? formatMoney(property.revenue) : "—"}
      </td>
      <td className="py-3 align-top">
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onSave}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {t("common.save")}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function SmartpricePropertyPricingSection({
  properties,
  canEditPrices,
  billingLocked,
}: SmartpricePropertyPricingSectionProps) {
  const { t } = useI18n();
  const canEdit = canEditPrices && !billingLocked;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("smartprice.pricing.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("smartprice.pricing.description")}
        </p>
      </CardHeader>
      <CardContent>
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("smartprice.pricing.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">{t("smartprice.pricing.property")}</th>
                  <th className="py-2 pr-3">{t("smartprice.pricing.min")}</th>
                  <th className="py-2 pr-3">{t("smartprice.pricing.base")}</th>
                  <th className="py-2 pr-3">{t("smartprice.pricing.max")}</th>
                  <th className="py-2 pr-3">{t("smartprice.pricing.recommended")}</th>
                  <th className="py-2 pr-3">{t("smartprice.insight.avgDelta")}</th>
                  <th className="py-2 pr-3">{t("smartprice.pricing.revenue")}</th>
                  <th className="py-2">{canEdit ? t("common.save") : ""}</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
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
