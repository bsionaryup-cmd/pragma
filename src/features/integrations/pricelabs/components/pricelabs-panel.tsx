"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  CheckCircle2,
  LineChart,
  RefreshCw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import {
  confirmPriceLabsSetupAction,
  fetchPriceLabsPricesAction,
  runPriceLabsFullSyncAction,
  syncPriceLabsListingsAction,
  syncPriceLabsOverridesAction,
  testPriceLabsConnectionAction,
} from "@/features/integrations/pricelabs/actions/pricelabs.actions";
import { PriceLabsApiKeyCard } from "@/features/integrations/pricelabs/components/pricelabs-api-key-card";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return <Badge className="bg-slate-100 text-slate-700">Sincronizando</Badge>;
  }
  if (!overview.config.configured) {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-800">
        En espera de API key
      </Badge>
    );
  }
  if (!overview.config.liveApiEnabled) {
    return (
      <Badge variant="outline" className="border-slate-300 text-slate-600">
        Dry-run
      </Badge>
    );
  }
  if (overview.integration.status === "CONNECTED") {
    return (
      <Badge className="bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
        Conectado
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
    <ModuleShellFlow className="bg-[#FAFBFC] px-4 py-6 pb-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
              Integraciones · Smart Price
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">
              PriceLabs
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#6B7280]">
              Customer API oficial — listings, precios dinámicos, overrides y
              datos de mercado.
            </p>
          </div>
          <HealthBadge overview={overview} />
        </header>

        {database.setupRequired ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Migración pendiente</p>
            <p className="mt-1">{database.hint}</p>
          </div>
        ) : null}

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
              <Row label="Modo" value={config.liveApiEnabled ? "Live" : "Dry-run"} />
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
                Smart Price snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Sync" value={`${metrics.syncedCount}/${metrics.propertyCount}`} />
              <Stat label="Último precio" value={formatDate(integration.lastPricesSyncAt)} />
              <Stat label="Subprecio" value={String(revenue.underpricedCount)} warn />
              <Stat label="Sobre precio" value={String(revenue.overpricedCount)} />
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
                Probar conexión
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(syncPriceLabsListingsAction)}
              >
                Pull listings
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(fetchPriceLabsPricesAction)}
              >
                Importar precios
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
              {canManage && config.configured && database.ready ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(confirmPriceLabsSetupAction)}
                >
                  Registrar integración
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending || !canSync}
                onClick={() => run(runPriceLabsFullSyncAction)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Forzar refresh
              </Button>
              {statusMsg ? (
                <p className="w-full text-sm text-[#6B7280]">{statusMsg}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Propiedades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-[#9CA3AF]">
                    <th className="py-2 pr-4">Propiedad</th>
                    <th className="py-2 pr-4">Listing</th>
                    <th className="py-2 pr-4">Base</th>
                    <th className="py-2 pr-4">Recomendado</th>
                    <th className="py-2 pr-4">Delta</th>
                    <th className="py-2">Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p) => (
                    <tr key={p.id} className="border-b border-[#F3F4F6]">
                      <td className="py-3 pr-4 font-medium">{p.name}</td>
                      <td className="py-3 pr-4 text-xs text-[#6B7280]">
                        {p.listingId ?? "—"}
                      </td>
                      <td className="py-3 pr-4">{formatMoney(p.baseRate)}</td>
                      <td className="py-3 pr-4 text-[#0E9F8D]">
                        {formatMoney(p.recommendedRate)}
                      </td>
                      <td className="py-3 pr-4">{formatMoney(p.priceDelta)}</td>
                      <td className="py-3 text-xs text-[#6B7280]">
                        {formatDate(p.lastSyncedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
      <p className={cn("font-semibold", warn && "text-amber-600")}>{value}</p>
    </div>
  );
}
