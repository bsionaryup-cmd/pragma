"use client";

import { useState, useTransition } from "react";
import { LineChart, Plug, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import {
  connectPriceLabsAction,
  fetchPriceLabsPricesAction,
  syncPriceLabsListingsAction,
  testPriceLabsConnectionAction,
} from "@/features/integrations/pricelabs/actions/pricelabs.actions";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PriceLabsPanelProps = {
  overview: PriceLabsOverviewDto;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value: string | null, currency = "COP") {
  if (!value) return "—";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

export function PriceLabsPanel({ overview }: PriceLabsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const { integration, config, properties, metrics, canManage } = overview;

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      try {
        const result = await fn();
        setTestMsg(result.message);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error inesperado";
        setTestMsg(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-pragma-soft lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Integraciones
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              PriceLabs
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Sincroniza listings de PRAGMA, obtén recomendaciones de precio
              dinámico y visualiza el delta frente a tu tarifa base.
            </p>
            {!config.liveApiEnabled ? (
              <p className="mt-2 text-xs text-muted-foreground">
                API en modo preparación. Activa{" "}
                <code className="rounded bg-muted px-1">
                  PRICELABS_API_ENABLED=true
                </code>{" "}
                con credenciales reales.
              </p>
            ) : null}
            {!config.configured ? (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Faltan PRICELABS_TOKEN o PRICELABS_USER_TOKEN en el servidor.
              </p>
            ) : null}
          </div>
          <Badge variant="outline" className="self-start px-3 py-1">
            {metrics.statusLabel}
          </Badge>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Salud"
            value={metrics.healthLabel}
            detail={`Último check: ${formatDate(integration.lastHealthCheckAt)}`}
            icon={Sparkles}
          />
          <MetricCard
            label="Listings"
            value={`${metrics.syncedCount}/${metrics.propertyCount}`}
            detail={`Sync listings: ${formatDate(integration.lastListingsSyncAt)}`}
            icon={Plug}
          />
          <MetricCard
            label="Precios"
            value={formatDate(integration.lastPricesSyncAt)}
            detail="Última consulta get_prices"
            icon={LineChart}
          />
          <MetricCard
            label="Modo"
            value={config.liveApiEnabled ? "Live API" : "Dry-run"}
            detail={
              integration.hasStoredUserToken
                ? "user_token override en DB"
                : "user_token desde entorno"
            }
            icon={TrendingUp}
          />
        </section>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Conexión y sincronización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-3 sm:max-w-md"
                action={(fd) => {
                  startTransition(async () => {
                    try {
                      const result = await connectPriceLabsAction(fd);
                      toast.success(result.message);
                      setTestMsg(result.message);
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Error al conectar",
                      );
                    }
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="pricelabs-userToken">
                    user_token (opcional override)
                  </Label>
                  <Input
                    id="pricelabs-userToken"
                    name="userToken"
                    type="password"
                    placeholder={
                      integration.hasStoredUserToken
                        ? "Guardado en servidor"
                        : "Usa PRICELABS_USER_TOKEN del .env"
                    }
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  Conectar PriceLabs
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(testPriceLabsConnectionAction)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Probar conexión
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(syncPriceLabsListingsAction)}
                >
                  Sincronizar listings
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => run(fetchPriceLabsPricesAction)}
                >
                  Obtener precios dinámicos
                </Button>
              </div>

              {testMsg ? (
                <p className="text-sm text-muted-foreground">{testMsg}</p>
              ) : null}
              {integration.lastError ? (
                <p className="text-sm text-destructive">{integration.lastError}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            Solo administradores pueden gestionar la integración PriceLabs.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Inteligencia de precios por propiedad</CardTitle>
          </CardHeader>
          <CardContent>
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay propiedades activas para sincronizar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Propiedad</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 font-medium">Base</th>
                      <th className="py-2 pr-4 font-medium">Recomendado</th>
                      <th className="py-2 pr-4 font-medium">Delta</th>
                      <th className="py-2 pr-4 font-medium">Fin de semana</th>
                      <th className="py-2 font-medium">Último sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((p) => (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.city}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline">{p.syncStatus}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          {formatMoney(p.baseRate)}
                        </td>
                        <td className="py-3 pr-4 text-pragma-electric">
                          {formatMoney(p.recommendedRate)}
                        </td>
                        <td className="py-3 pr-4">
                          {p.priceDelta
                            ? `${Number.parseFloat(p.priceDelta) >= 0 ? "+" : ""}${formatMoney(p.priceDelta)}`
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {p.weekendUpliftPct
                            ? `${(Number.parseFloat(p.weekendUpliftPct) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {formatDate(p.lastSyncedAt)}
                          {p.lastError ? (
                            <p className="text-xs text-destructive">{p.lastError}</p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}
