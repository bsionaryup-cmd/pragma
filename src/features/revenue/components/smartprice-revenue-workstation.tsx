"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
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
  formatCompactMoney,
  formatPriceDelta,
  formatPriceLabsMoney,
  formatRelativeSync,
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
import { Input } from "@/components/ui/input";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

type PropertyRow = PriceLabsOverviewDto["properties"][number];
type AuditRow = PriceLabsOverviewDto["auditLog"][number];

type SmartpriceRevenueWorkstationProps = {
  properties: PropertyRow[];
  canEditPrices: boolean;
  billingLocked: boolean;
  reviewPropertyIds: string[];
  searchQuery?: string;
  auditLog?: AuditRow[];
  syncing?: boolean;
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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

function isBooked(status: string | null | undefined) {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s.includes("book") ||
    s.includes("reserv") ||
    s.includes("occupied") ||
    s.includes("ocup") ||
    s === "b"
  );
}

function RateInput({
  value,
  onChange,
  canEdit,
  pending,
  optional = false,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  pending: boolean;
  optional?: boolean;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {optional ? (
          <span className="ml-1 font-normal normal-case">(opc.)</span>
        ) : null}
      </label>
      {canEdit ? (
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={optional ? "Sin definir" : "0"}
          className="h-10 text-base font-semibold tabular-nums"
          disabled={pending}
        />
      ) : (
        <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-base font-semibold tabular-nums">
          {value ? formatPriceLabsMoney(value) : "Sin definir"}
        </p>
      )}
    </div>
  );
}

function OccupancyPill({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const n = Number.parseFloat(value);
  const tone =
    !Number.isFinite(n)
      ? "bg-muted text-muted-foreground"
      : n >= 70
        ? "bg-emerald-500/15 text-emerald-800"
        : n >= 30
          ? "bg-amber-500/15 text-amber-800"
          : "bg-destructive/10 text-destructive";
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.25rem] justify-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
        tone,
      )}
    >
      {value}
    </span>
  );
}

function buildMonthChunks(days: CalendarDayPreview[]) {
  const byMonth = new Map<string, CalendarDayPreview[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(day);
    byMonth.set(key, list);
  }
  return [...byMonth.entries()].map(([monthKey, monthDays]) => {
    const first = new Date(`${monthDays[0].date}T12:00:00.000Z`);
    const label = first.toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    // Monday-first pad
    const startDow = (first.getUTCDay() + 6) % 7;
    return { monthKey, label, days: monthDays, startDow };
  });
}

function PropertyWorkspace({
  property,
  canEdit,
  auditLog,
  onBack,
}: {
  property: PropertyRow;
  canEdit: boolean;
  auditLog: AuditRow[];
  onBack: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
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
  const today = insights.next14Days[0];
  const displayPrice = useMemo(
    () => resolveRevenueDisplayPrice(property),
    [property],
  );
  const months = useMemo(
    () => buildMonthChunks(insights.next14Days),
    [insights.next14Days],
  );

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

  const recentAudit = auditLog.slice(0, 8);

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-pragma-soft">
      <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-pragma-electric hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al dashboard
          </button>
          <h2 className="truncate text-lg font-semibold text-foreground">
            {unitNumber}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{property.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="outline"
              className={cn("text-[11px]", syncBadgeClass(property.syncStatus))}
            >
              {syncStatusLabel(property.syncStatus)}
            </Badge>
            <span className="text-muted-foreground">
              Última sync {formatRelativeSync(property.lastSyncedAt ?? insights.lastPricesSync)}
            </span>
            {property.lastError ? (
              <span className="text-destructive">{property.lastError}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && property.listingId ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                className="h-9 gap-1.5"
                onClick={() =>
                  run(() => syncSinglePriceLabsListingAction(property.id))
                }
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={onSaveBounds}
                className="h-9 gap-1.5 bg-pragma-electric font-semibold hover:bg-pragma-mid-blue"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,260px)]">
        {/* Left panel — real config only */}
        <aside className="space-y-4 border-b border-border/70 p-4 lg:border-b-0 lg:border-r">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Configurar precios
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Límites canónicos de la propiedad
            </p>
          </div>
          <RateInput
            label="Mínimo"
            value={minRate}
            onChange={setMinRate}
            canEdit={canEdit}
            pending={pending}
          />
          <RateInput
            label="Base"
            value={baseRate}
            onChange={setBaseRate}
            canEdit={canEdit}
            pending={pending}
          />
          <RateInput
            label="Máximo"
            value={maxRate}
            onChange={setMaxRate}
            canEdit={canEdit}
            pending={pending}
            optional
          />

          {today?.minStay != null && today.minStay > 0 ? (
            <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Estancia mínima (hoy)
              </p>
              <p className="mt-1 font-semibold">
                {formatMinStayLabel(today.minStay)}
              </p>
            </div>
          ) : null}

          {(today?.weeklyDiscount != null && today.weeklyDiscount !== 0) ||
          (today?.monthlyDiscount != null && today.monthlyDiscount !== 0) ? (
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-sm">
              {today.weeklyDiscount != null && today.weeklyDiscount !== 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Descuento semanal
                  </p>
                  <p className="font-semibold tabular-nums">
                    {today.weeklyDiscount}%
                  </p>
                </div>
              ) : null}
              {today.monthlyDiscount != null && today.monthlyDiscount !== 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Descuento mensual
                  </p>
                  <p className="font-semibold tabular-nums">
                    {today.monthlyDiscount}%
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {canEdit && property.listingId ? (
            <div className="space-y-3 border-t border-border/60 pt-4">
              <h4 className="text-sm font-semibold">
                {t("smartprice.pricing.adjustmentsTitle")}
              </h4>
              <div className="grid gap-2">
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
                  placeholder="Estancia mín."
                  value={overrideMinStay}
                  onChange={(e) => setOverrideMinStay(e.target.value)}
                  className="h-9 text-sm"
                  disabled={pending}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    inputMode="numeric"
                    placeholder="Min día"
                    value={overrideMinPrice}
                    onChange={(e) => setOverrideMinPrice(e.target.value)}
                    className="h-9 text-sm"
                    disabled={pending}
                  />
                  <Input
                    inputMode="numeric"
                    placeholder="Max día"
                    value={overrideMaxPrice}
                    onChange={(e) => setOverrideMaxPrice(e.target.value)}
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
                  Guardar ajuste
                </Button>
              </div>
            </div>
          ) : null}
        </aside>

        {/* Center — calendar hero */}
        <section className="min-w-0 space-y-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Calendario</h3>
              <p className="text-xs text-muted-foreground">
                Precio · demanda · estancia · reserva · anulación
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-emerald-500/25 ring-1 ring-emerald-500/30" />
                Bajo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-emerald-600/20 ring-1 ring-emerald-600/30" />
                Normal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-pragma-light-blue ring-1 ring-pragma-electric/35" />
                Alto
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-pragma-soft-cyan ring-1 ring-pragma-cyan/40" />
                Anulación
              </span>
            </div>
          </div>

          {!insights.hasDailyPrices ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("smartprice.pricing.calendarEmpty")}
            </p>
          ) : (
            months.map((month) => (
              <div key={month.monthKey} className="space-y-2">
                <h4 className="text-sm font-semibold capitalize text-foreground">
                  {month.label}
                </h4>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: month.startDow }).map((_, i) => (
                    <div key={`pad-${month.monthKey}-${i}`} />
                  ))}
                  {month.days.map((day) => {
                    const booked = isBooked(day.bookingStatus);
                    const elevatedMin = day.minStay != null && day.minStay > 1;
                    const isSelected = selectedDay === day.date;
                    const dayNum = Number(day.date.slice(8, 10));
                    const cellClassName = cn(
                      "relative min-h-[4.5rem] rounded-md border px-1 py-1.5 text-center transition-colors",
                      booked
                        ? "border-pragma-navy/20 bg-pragma-navy/5"
                        : day.hasOverride
                          ? "border-pragma-cyan/50 bg-pragma-soft-cyan/30"
                          : demandLevelClass(day.demandLevel),
                      elevatedMin && !day.hasOverride && !booked
                        ? "ring-1 ring-pragma-electric/25"
                        : null,
                      isSelected ? "ring-2 ring-pragma-electric" : null,
                      canEdit && property.listingId && !booked
                        ? "cursor-pointer hover:border-pragma-electric/50"
                        : null,
                    );
                    const inner = (
                      <>
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {dayNum}
                        </p>
                        <p className="mt-0.5 text-xs font-bold tabular-nums text-foreground">
                          {formatCompactMoney(day.recommended)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                          {booked ? (
                            <span className="rounded bg-pragma-navy/10 px-1 text-[9px] font-semibold text-pragma-navy">
                              Res.
                            </span>
                          ) : null}
                          {day.hasOverride ? (
                            <span className="rounded bg-pragma-cyan/20 px-1 text-[9px] font-semibold text-pragma-electric">
                              Adj.
                            </span>
                          ) : null}
                          {elevatedMin ? (
                            <span className="rounded bg-pragma-electric/10 px-1 text-[9px] font-semibold text-pragma-electric">
                              {day.minStay}n
                            </span>
                          ) : null}
                          {day.checkIn ? (
                            <span className="text-[9px] text-muted-foreground">↓</span>
                          ) : null}
                          {day.checkOut ? (
                            <span className="text-[9px] text-muted-foreground">↑</span>
                          ) : null}
                        </div>
                      </>
                    );
                    return canEdit && property.listingId && !booked ? (
                      <button
                        key={day.date}
                        type="button"
                        className={cellClassName}
                        title={
                          day.pricingReason ??
                          day.demandLevel ??
                          day.bookingStatus ??
                          undefined
                        }
                        onClick={() => applyDayToAdjustment(day)}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        key={day.date}
                        className={cellClassName}
                        title={
                          day.pricingReason ??
                          day.demandLevel ??
                          day.bookingStatus ??
                          undefined
                        }
                      >
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <p className="text-xs text-muted-foreground">
            Recomendado hoy:{" "}
            <span className="font-semibold text-foreground">
              {displayPrice.recommended != null
                ? formatPriceLabsMoney(String(displayPrice.recommended))
                : "—"}
            </span>
            {displayPrice.delta != null ? (
              <>
                {" "}
                · Δ {formatPriceDelta(String(displayPrice.delta))}
              </>
            ) : null}
          </p>
        </section>

        {/* Right panel — dynamic metrics */}
        <aside className="space-y-4 border-t border-border/70 bg-muted/10 p-4 lg:border-l lg:border-t-0">
          <div>
            <h3 className="text-sm font-semibold">Métricas</h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">Ocupación</span>
                <OccupancyPill value={property.occupancy} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span className="text-sm font-semibold tabular-nums">
                  {property.revenue
                    ? formatPriceLabsMoney(property.revenue)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground">Ajustes</span>
                <span className="text-sm font-semibold tabular-nums">
                  {insights.overrideCount}
                </span>
              </div>
            </div>
          </div>

          {insights.ratePlanHints.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Señales de precio
              </h4>
              <ul className="mt-2 space-y-1.5">
                {insights.ratePlanHints.map((hint) => (
                  <li
                    key={hint}
                    className="rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs text-foreground/90"
                  >
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Anulaciones próximas
            </h4>
            {insights.upcomingOverrides.length > 0 ? (
              <ul className="mt-2 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 bg-card">
                {insights.upcomingOverrides.map((row) => (
                  <li
                    key={row.date}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs"
                  >
                    <span className="font-medium">{formatShortDate(row.date)}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.price != null
                        ? formatPriceLabsMoney(String(row.price))
                        : "—"}
                      {row.minStay != null
                        ? ` · ${formatMinStayLabel(row.minStay) ?? ""}`
                        : ""}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="text-destructive disabled:opacity-50"
                        disabled={pending}
                        aria-label="Eliminar ajuste"
                        onClick={() =>
                          run(() =>
                            deletePriceLabsOverridesAction({
                              propertyId: property.id,
                              dates: [row.date],
                            }),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sin anulaciones</p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Historial de sync
            </h4>
            {recentAudit.length > 0 ? (
              <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                {recentAudit.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-[11px]"
                  >
                    <p className="font-medium text-foreground">
                      {row.action} · {row.result}
                    </p>
                    <p className="text-muted-foreground">
                      {formatRelativeSync(row.createdAt)} · {row.source}
                    </p>
                    {row.message ? (
                      <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                        {row.message}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sin eventos aún</p>
            )}
          </div>

          <Link
            href="/calendar"
            className="inline-block text-xs font-semibold text-pragma-electric hover:underline"
          >
            Abrir calendario operativo →
          </Link>
        </aside>
      </div>
    </div>
  );
}

export function SmartpriceRevenueWorkstation({
  properties,
  canEditPrices,
  billingLocked,
  searchQuery = "",
  auditLog = [],
  syncing = false,
}: SmartpriceRevenueWorkstationProps) {
  const { t } = useI18n();
  const canEdit = canEditPrices && !billingLocked;
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedId) ?? null,
    [properties, selectedId],
  );

  if (selected) {
    return (
      <PropertyWorkspace
        key={selected.id}
        property={selected}
        canEdit={canEdit}
        auditLog={auditLog}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-pragma-soft">
      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("smartprice.pricing.title")}</h2>
          <p className="text-xs text-muted-foreground">
            Mostrando {visibleProperties.length}/{properties.length} listados
            {syncing ? " · sincronizando…" : ""}
          </p>
        </div>
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
      </div>

      {visibleProperties.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {anomaliesOnly && !searchQuery.trim()
            ? t("smartprice.pricing.anomaliesEmpty")
            : t("smartprice.pricing.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="bg-muted/25 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                <th className="border-b border-border px-3 py-3">Listado</th>
                <th className="border-b border-border px-3 py-3">Calendario</th>
                <th className="border-b border-border px-3 py-3">Sincronización</th>
                <th className="border-b border-border px-3 py-3">Mínimo</th>
                <th className="border-b border-border px-3 py-3">Base</th>
                <th className="border-b border-border px-3 py-3">Máximo</th>
                <th className="border-b border-border px-3 py-3">Ocupación</th>
                <th className="border-b border-border px-3 py-3">Ciudad</th>
              </tr>
            </thead>
            <tbody>
              {visibleProperties.map((property) => {
                const unitNumber = resolveUnitNumber(property);
                return (
                  <tr
                    key={property.id}
                    className={cn(
                      "border-b border-border/60 transition-colors hover:bg-muted/10",
                      property.syncStatus === "ERROR" && "bg-destructive/5",
                      !property.listingId && "bg-warning/5",
                    )}
                  >
                    <td className="px-3 py-3 align-middle">
                      <button
                        type="button"
                        className="min-w-[10rem] text-left"
                        onClick={() => setSelectedId(property.id)}
                      >
                        <p className="text-base font-bold tabular-nums text-pragma-electric hover:underline">
                          {unitNumber}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {property.name}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {!property.listingId ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px]",
                                getSemanticBadgeClass("warning"),
                              )}
                            >
                              Sin mapeo
                            </Badge>
                          ) : null}
                          {property.insights.overrideCount > 0 ? (
                            <Badge variant="outline" className="text-[11px]">
                              {property.insights.overrideCount} ajustes
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setSelectedId(property.id)}
                        className="h-9 bg-pragma-electric px-3 font-semibold hover:bg-pragma-mid-blue"
                      >
                        Revisar precios
                      </Button>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-5 w-9 items-center rounded-full px-0.5",
                            property.syncStatus === "SYNCED"
                              ? "bg-emerald-500/90"
                              : property.syncStatus === "ERROR"
                                ? "bg-destructive/80"
                                : "bg-muted",
                          )}
                          aria-hidden
                        >
                          <span
                            className={cn(
                              "size-4 rounded-full bg-white shadow-sm transition",
                              property.syncStatus === "SYNCED"
                                ? "translate-x-4"
                                : "translate-x-0",
                            )}
                          />
                        </span>
                        <div>
                          <p className="text-xs font-medium">
                            {syncStatusLabel(property.syncStatus)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatRelativeSync(
                              property.lastSyncedAt ??
                                property.insights.lastPricesSync,
                            )}
                          </p>
                        </div>
                      </div>
                      {property.lastError ? (
                        <p className="mt-1 max-w-[12rem] truncate text-[11px] text-destructive">
                          {property.lastError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-middle text-base font-semibold tabular-nums">
                      {property.minRate
                        ? formatPriceLabsMoney(property.minRate)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 align-middle text-base font-semibold tabular-nums">
                      {property.baseRate
                        ? formatPriceLabsMoney(property.baseRate)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 align-middle text-sm tabular-nums text-muted-foreground">
                      {property.maxRate
                        ? formatPriceLabsMoney(property.maxRate)
                        : "Sin definir"}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <OccupancyPill value={property.occupancy} />
                    </td>
                    <td className="px-3 py-3 align-middle text-sm text-muted-foreground">
                      {property.city || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
