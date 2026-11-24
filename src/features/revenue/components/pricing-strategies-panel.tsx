"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  refreshListingCustomizationsAction,
  saveFarOutCustomizationAction,
  saveLastMinuteCustomizationAction,
} from "@/features/revenue/actions/smartprice.actions";
import {
  formatRelativeSync,
} from "@/features/integrations/pricelabs/lib/pricelabs-format";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import type {
  PriceLabsFarOutProfile,
  PriceLabsLastMinuteProfile,
} from "@/integrations/pricelabs/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PropertyRow = PriceLabsOverviewDto["properties"][number];

const LAST_MINUTE_OPTIONS: Array<{ value: PriceLabsLastMinuteProfile; label: string }> = [
  { value: "recommended", label: "Recomendado" },
  { value: "conservative", label: "Conservador" },
  { value: "aggressive", label: "Agresivo" },
  { value: "linear", label: "Lineal (manual)" },
  { value: "linear_gradual", label: "Lineal gradual" },
  { value: "fixed", label: "Precio fijo" },
  { value: "none", label: "Sin ajuste" },
];

const FAR_OUT_OPTIONS: Array<{ value: PriceLabsFarOutProfile; label: string }> = [
  { value: "recommended", label: "Recomendado" },
  { value: "conservative", label: "Conservador" },
  { value: "aggressive", label: "Agresivo" },
  { value: "linear", label: "Lineal (manual)" },
  { value: "fix", label: "Fijo (manual)" },
  { value: "none", label: "Sin ajuste" },
];

function selectClassName() {
  return "h-9 w-full rounded-md border border-border bg-background px-2 text-sm";
}

export function PricingStrategiesPanel({
  property,
  canEdit,
}: {
  property: PropertyRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cfg = property.insights.customizations;

  const [lmOn, setLmOn] = useState(cfg.lastMinuteOn ?? false);
  const [lmProfile, setLmProfile] = useState<PriceLabsLastMinuteProfile>(
    (cfg.lastMinuteProfile as PriceLabsLastMinuteProfile) || "recommended",
  );
  const [lmValue, setLmValue] = useState("");
  const [lmDfd, setLmDfd] = useState("14");

  const [foOn, setFoOn] = useState(cfg.farOutOn ?? false);
  const [foProfile, setFoProfile] = useState<PriceLabsFarOutProfile>(
    (cfg.farOutProfile as PriceLabsFarOutProfile) || "recommended",
  );
  const [foValue, setFoValue] = useState("");
  const [foStart, setFoStart] = useState("90");
  const [foStep, setFoStep] = useState("7");

  const lmNeedsValue =
    lmProfile === "linear" || lmProfile === "linear_gradual" || lmProfile === "fixed";
  const foNeedsValue = foProfile === "linear" || foProfile === "fix";

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  const origin =
    property.insights.lastCustomizationsWriteSource === "pragma"
      ? "Configurado desde PRAGMA"
      : property.insights.lastCustomizationsSync
        ? "Sincronizado desde PriceLabs"
        : "Sin sincronizar";

  return (
    <div className="space-y-3 border-t border-border/70 pt-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Estrategias tarifarias
          </h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {origin}
            {property.insights.lastCustomizationsSync
              ? ` · ${formatRelativeSync(property.insights.lastCustomizationsSync)}`
              : ""}
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={pending}
            onClick={() =>
              run(() => refreshListingCustomizationsAction(property.id))
            }
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span className="ml-1">Leer PL</span>
          </Button>
        ) : null}
      </div>

      {/* Último minuto */}
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Último minuto</p>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={lmOn}
              disabled={!canEdit || pending}
              onChange={(e) => setLmOn(e.target.checked)}
              className="size-3.5 accent-pragma-electric"
            />
            Activo
          </label>
        </div>
        <select
          className={selectClassName()}
          value={lmProfile}
          disabled={!canEdit || pending || !lmOn}
          onChange={(e) =>
            setLmProfile(e.target.value as PriceLabsLastMinuteProfile)
          }
        >
          {LAST_MINUTE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {lmOn && lmNeedsValue ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="decimal"
              placeholder={lmProfile === "fixed" ? "Precio" : "% (+/-)"}
              value={lmValue}
              onChange={(e) => setLmValue(e.target.value)}
              className="h-8 text-xs"
              disabled={!canEdit || pending}
            />
            <Input
              inputMode="numeric"
              placeholder="Días (1-90)"
              value={lmDfd}
              onChange={(e) => setLmDfd(e.target.value)}
              className="h-8 text-xs"
              disabled={!canEdit || pending}
            />
          </div>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            className="h-8 w-full text-xs"
            disabled={pending}
            onClick={() =>
              run(() =>
                saveLastMinuteCustomizationAction({
                  propertyId: property.id,
                  enabled: lmOn,
                  profile: lmProfile,
                  value: lmValue ? Number(lmValue) : null,
                  daysFromCheckIn: lmDfd ? Number(lmDfd) : null,
                }),
              )
            }
          >
            Guardar último minuto
          </Button>
        ) : null}
      </div>

      {/* Reservas anticipadas (far out) */}
      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Reservas anticipadas
          </p>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={foOn}
              disabled={!canEdit || pending}
              onChange={(e) => setFoOn(e.target.checked)}
              className="size-3.5 accent-pragma-electric"
            />
            Activo
          </label>
        </div>
        <select
          className={selectClassName()}
          value={foProfile}
          disabled={!canEdit || pending || !foOn}
          onChange={(e) => setFoProfile(e.target.value as PriceLabsFarOutProfile)}
        >
          {FAR_OUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {foOn && foNeedsValue ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="numeric"
              placeholder="% (+/-)"
              value={foValue}
              onChange={(e) => setFoValue(e.target.value)}
              className="h-8 text-xs"
              disabled={!canEdit || pending}
            />
            <Input
              inputMode="numeric"
              placeholder="Inicio (días)"
              value={foStart}
              onChange={(e) => setFoStart(e.target.value)}
              className="h-8 text-xs"
              disabled={!canEdit || pending}
            />
            {foProfile === "linear" ? (
              <Input
                inputMode="numeric"
                placeholder="Paso (días)"
                value={foStep}
                onChange={(e) => setFoStep(e.target.value)}
                className="h-8 text-xs col-span-2"
                disabled={!canEdit || pending}
              />
            ) : null}
          </div>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            className="h-8 w-full text-xs"
            disabled={pending}
            onClick={() =>
              run(() =>
                saveFarOutCustomizationAction({
                  propertyId: property.id,
                  enabled: foOn,
                  profile: foProfile,
                  value: foValue ? Number(foValue) : null,
                  startDays: foStart ? Number(foStart) : null,
                  stepDays: foStep ? Number(foStep) : null,
                }),
              )
            }
          >
            Guardar reservas anticipadas
          </Button>
        ) : null}
      </div>

      <p
        className={cn(
          "text-[10px] leading-snug text-muted-foreground",
        )}
      >
        Estadía mínima general del listing se gestiona en PriceLabs (la API
        aún no soporta esa customization). Aquí solo se administran estrategias
        con endpoint writable. Espacios libres e impulso de reservas no se
        simulan.
      </p>
    </div>
  );
}
