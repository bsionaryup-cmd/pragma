"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
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
import { PriceLabsMappingSummary } from "@/features/integrations/pricelabs/components/pricelabs-mapping-summary";
import { formatPriceLabsDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import { cn } from "@/lib/utils";

type PriceLabsPanelProps = {
  overview: PriceLabsOverviewDto;
};

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
        Key inválida
      </Badge>
    );
  }
  if (!overview.config.liveApiEnabled) {
    return (
      <Badge variant="outline" className={getSemanticBadgeClass("warning")}>
        Simulación
      </Badge>
    );
  }
  if (status === "CONNECTED") {
    return <Badge className={getSemanticBadgeClass("success")}>Conectado</Badge>;
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

function IntegrationSection({
  title,
  accent = "electric",
  children,
}: {
  title: string;
  accent?: "electric" | "cyan";
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card pl-3",
        accent === "cyan"
          ? "border-l-[3px] border-l-pragma-cyan"
          : "border-l-[3px] border-l-pragma-electric",
      )}
    >
      <div className="border-b border-border/60 px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

export function PriceLabsPanel({ overview }: PriceLabsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const {
    integration,
    database,
    config,
    properties,
    auditLog,
    canManage,
    syncing,
    metrics,
    insights,
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
    <ModuleShellFlow className="bg-background px-3 py-4 pb-10 text-foreground sm:px-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink href="/integrations" label="Integraciones" />

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pragma-electric">
              Configuración · Integraciones
            </p>
            <h1 className="text-lg font-semibold tracking-tight">PriceLabs · Conexión</h1>
            <p className="mt-1 text-sm text-foreground/75">
              API key, validación y pipeline de sync. La gestión diaria de tarifas está en{" "}
              <Link href="/revenue" className="font-medium text-pragma-electric hover:underline">
                Tarifas
              </Link>
              .
            </p>
          </div>
          <HealthBadge overview={overview} />
        </header>

        <Link
          href="/revenue"
          className="flex items-center justify-between gap-3 rounded-lg border border-pragma-cyan/40 bg-pragma-soft-cyan/25 px-3 py-2.5 transition-colors hover:bg-pragma-soft-cyan/40"
        >
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-pragma-electric" />
            <div>
              <p className="text-sm font-medium text-foreground">Módulo Tarifas</p>
              <p className="text-xs text-foreground/70">
                Límites, calendario 14d, overrides y alertas de revenue
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-pragma-electric" />
        </Link>

        {database.setupRequired ? (
          <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning">
            <p className="font-medium">Migración pendiente</p>
            <p className="mt-0.5">{database.hint}</p>
          </div>
        ) : null}

        {canManage && config.configured && !config.liveApiEnabled ? (
          <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning">
            Modo simulación — activa{" "}
            <code className="rounded bg-warning/20 px-1">PRICELABS_API_ENABLED</code> en
            servidor.
          </div>
        ) : null}

        {integration.lastError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {integration.lastError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Sync" value={`${metrics.syncedCount}/${metrics.propertyCount}`} />
          <Stat
            label="Sin mapeo"
            value={String(insights.unmappedListings)}
            warn={insights.unmappedListings > 0}
          />
          <Stat
            label="Issues"
            value={String(insights.syncIssues)}
            warn={insights.syncIssues > 0}
          />
          <Stat label="Salud" value={metrics.healthLabel} />
        </div>

        <IntegrationSection title="Credenciales API">
          <PriceLabsApiKeyCard overview={overview} canManage={canManage} embedded />
        </IntegrationSection>

        {canManage ? (
          <IntegrationSection title="Pipeline de sincronización" accent="cyan">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                disabled={pending || !canSync}
                onClick={() => run(testPriceLabsConnectionAction)}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Validar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                disabled={pending || !canSync}
                onClick={() => run(syncPriceLabsListingsAction)}
              >
                Listings
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                disabled={pending || !canSync}
                onClick={() => run(fetchPriceLabsPricesAction)}
              >
                Precios
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                disabled={pending || !canSync}
                onClick={() => run(syncPriceLabsOverridesAction)}
              >
                Overrides
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 px-2.5 text-xs"
                disabled={pending || !canSync}
                onClick={() => run(runPriceLabsFullSyncAction)}
              >
                <Zap className="mr-1 h-3.5 w-3.5" />
                Pipeline completo
              </Button>
              {config.configured ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 px-2 text-xs text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("¿Desconectar PriceLabs?")) return;
                    run(disconnectPriceLabsAction);
                  }}
                >
                  Desconectar
                </Button>
              ) : null}
            </div>
            {statusMsg ? (
              <p className="mt-2 text-xs text-foreground/70">{statusMsg}</p>
            ) : null}
            <p className="mt-2 text-xs text-foreground/65">
              Health {formatPriceLabsDate(integration.lastHealthCheckAt)} · Listings{" "}
              {formatPriceLabsDate(integration.lastListingsSyncAt)} · Precios{" "}
              {formatPriceLabsDate(integration.lastPricesSyncAt)}
            </p>
          </IntegrationSection>
        ) : null}

        <IntegrationSection title="Mapeo propiedades ↔ listings">
          <PriceLabsMappingSummary properties={properties} />
        </IntegrationSection>

        <div className="rounded-lg border border-border bg-card">
          <button
            type="button"
            onClick={() => setAuditOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/20"
          >
            <span className="text-sm font-medium text-foreground">
              Audit log · {auditLog.length}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-foreground/60 transition",
                auditOpen && "rotate-180",
              )}
            />
          </button>
          {auditOpen ? (
            <ul className="divide-y divide-border/60 border-t border-border/60 text-xs">
              {auditLog.length === 0 ? (
                <li className="px-3 py-3 text-foreground/70">Sin eventos.</li>
              ) : (
                auditLog.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{e.action}</p>
                      <p className="text-foreground/70">
                        {formatPriceLabsDate(e.createdAt)} · {e.source}
                      </p>
                      {e.message ? (
                        <p className="truncate text-foreground/65">{e.message}</p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {e.result}
                    </Badge>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        {canManage && !config.configured ? (
          <div className="rounded-lg border border-border bg-pragma-light-blue/30 px-3 py-2.5 text-sm text-foreground/75">
            <p className="font-medium text-foreground">Primeros pasos</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Pega tu Customer API key.</li>
              <li>Ejecuta «Pipeline completo».</li>
              <li>Abre Tarifas para revisar precios y overrides.</li>
            </ol>
          </div>
        ) : null}
      </div>
    </ModuleShellFlow>
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
    <div className="rounded-md border border-border/70 bg-card px-2.5 py-2">
      <p className="text-[11px] text-foreground/65">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums text-foreground",
          warn && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}
