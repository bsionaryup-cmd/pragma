"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  CheckCircle2,
  LineChart,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import {
  disconnectPriceLabsAction,
  fetchPriceLabsPricesAction,
  runPriceLabsFullSyncAction,
  syncPriceLabsListingsAction,
  syncPriceLabsOverridesAction,
  testPriceLabsConnectionAction,
} from "@/features/integrations/pricelabs/actions/pricelabs.actions";
import { PriceLabsApiKeyCard } from "@/features/integrations/pricelabs/components/pricelabs-api-key-card";
import { PriceLabsInsightsSection } from "@/features/integrations/pricelabs/components/pricelabs-insights-section";
import { PriceLabsOverridesPanel } from "@/features/integrations/pricelabs/components/pricelabs-overrides-panel";
import { PriceLabsPropertyDetailCard } from "@/features/integrations/pricelabs/components/pricelabs-property-detail-card";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { cn } from "@/lib/utils";

type PriceLabsPanelProps = {
  overview: PriceLabsOverviewDto;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
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

function HealthBadge({ overview }: { overview: PriceLabsOverviewDto }) {
  if (overview.syncing) {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("neutral")}>
        Sincronizando
      </Badge>
    );
  }

  const status = overview.integration.status;

  if (status === "NOT_CONNECTED" || !overview.config.configured) {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("warning")}>
        No conectado
      </Badge>
    );
  }
  if (status === "INVALID_KEY") {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("warning")}>
        API key inválida
      </Badge>
    );
  }
  if (!overview.config.liveApiEnabled) {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("warning")}>
        Modo simulación
      </Badge>
    );
  }
  if (status === "CONNECTED") {
    return (
      <Badge className={getSemanticBadgeClass("success")}>Conectado</Badge>
    );
  }
  if (status === "SYNC_REQUIRED") {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("warning")}>
        Sync requerido
      </Badge>
    );
  }
  if (status === "SYNC_FAILED") {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("warning")}>
        Sync fallido
      </Badge>
    );
  }
  return <Badge variant="outline">{overview.metrics.statusLabel}</Badge>;
}

export function PriceLabsPanel({ overview }: PriceLabsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const {
    integration,
    database,
    config,
    properties,
    metrics,
    revenue,
    auditLog,
    canManage,
    syncing,
  } = overview;

  const canSync =
    database.ready && config.configured && !syncing && !database.setupRequired;

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      try {
        const result = await fn();
        setStatusMsg(result.message);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error inesperado";
        setStatusMsg(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <BackLink href="/integrations" label="Integraciones" />
        <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-pragma-soft lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
              Integraciones · PriceLabs
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              PriceLabs
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Conecta tu cuenta PriceLabs para sincronizar listings y precios
              dinámicos con tus propiedades en PRAGMA.
            </p>
          </div>
          <HealthBadge overview={overview} />
        </header>

        {database.setupRequired ? (
          <div className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
            <p className="font-medium">Migración pendiente</p>
            <p className="mt-1">{database.hint}</p>
          </div>
        ) : null}

        {canManage && !config.configured ? (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
            <p className="font-medium text-foreground">Conectar PriceLabs</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                En PriceLabs: Account Settings → API Details → copia tu Customer
                API key.
              </li>
              <li>Pégala abajo y pulsa «Guardar y conectar».</li>
              <li>
                PRAGMA validará la key contra{" "}
                <code className="rounded bg-muted px-1 text-xs">GET /v1/listings</code>.
              </li>
              <li>
                Luego usa «Pipeline completo» para vincular listings e importar
                precios.
              </li>
            </ol>
          </div>
        ) : null}

        {canManage && config.configured && !config.liveApiEnabled ? (
          <div className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
            <p className="font-medium">Modo simulación activo</p>
            <p className="mt-1">
              El servidor tiene{" "}
              <code className="rounded bg-warning/20 px-1">PRICELABS_API_ENABLED=false</code>.
              Quita esa variable (o cámbiala) en Vercel para usar la API real de
              PriceLabs.
            </p>
          </div>
        ) : null}

        <PriceLabsInsightsSection overview={overview} />

        <div className="grid gap-4 lg:grid-cols-3">
          <PriceLabsApiKeyCard overview={overview} canManage={canManage} />

          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Salud
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Estado" value={metrics.healthLabel} />
              <Row
                label="Modo"
                value={config.liveApiEnabled ? "Live (API real)" : "Simulación"}
              />
              <Row label="Health check" value={formatDate(integration.lastHealthCheckAt)} />
              <Row label="Listings sync" value={formatDate(integration.lastListingsSyncAt)} />
              {integration.lastError ? (
                <p className="text-xs text-red-600">{integration.lastError}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LineChart className="h-4 w-4" />
                Resumen de tarifas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Sincronizadas" value={`${metrics.syncedCount}/${metrics.propertyCount}`} />
              <Stat label="Última sync" value={formatDate(integration.lastPricesSyncAt)} />
              <div className="col-span-2 border-t pt-2">
                <p className="text-xs text-[#9CA3AF]">Delta promedio</p>
                <p className="font-semibold">{formatMoney(revenue.avgDelta)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {canManage ? (
          <Card className="border-[#E5E7EB] bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Sincronización</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(testPriceLabsConnectionAction)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Validar conexión
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(syncPriceLabsListingsAction)}
              >
                Sync listings
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(fetchPriceLabsPricesAction)}
              >
                Sync precios
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(syncPriceLabsOverridesAction)}
              >
                Pull overrides
              </Button>
              {canManage && config.configured ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    if (!window.confirm("¿Desconectar PriceLabs de esta organización?")) return;
                    run(disconnectPriceLabsAction);
                  }}
                >
                  Desconectar
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(runPriceLabsFullSyncAction)}
              >
                <Zap className="mr-2 h-4 w-4" />
                Pipeline completo
              </Button>
              {statusMsg ? (
                <p className="w-full text-sm text-[#6B7280]">{statusMsg}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <PriceLabsOverridesPanel overview={overview} canManage={canManage} />

        <div className="space-y-3">
          <h2 className="text-base font-semibold">Propiedades vinculadas</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay propiedades activas.</p>
          ) : (
            properties.map((property) => (
              <PriceLabsPropertyDetailCard key={property.id} property={property} />
            ))
          )}
        </div>

        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Audit log</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-sm text-[#6B7280]">Sin eventos.</p>
            ) : (
              <ul className="divide-y divide-[#F3F4F6]">
                {auditLog.map((e) => (
                  <li key={e.id} className="flex justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{e.action}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {formatDate(e.createdAt)} · {e.source}
                      </p>
                      {e.message ? (
                        <p className="text-xs text-[#6B7280]">{e.message}</p>
                      ) : null}
                    </div>
                    <Badge variant="outline">{e.result}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#6B7280]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[#9CA3AF]">{label}</p>
      <p className={cn("font-semibold", warn && "text-warning")}>{value}</p>
    </div>
  );
}
