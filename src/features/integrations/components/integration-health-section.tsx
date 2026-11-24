"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recoverIntegrationsAction } from "@/features/integrations/actions/integration-health.actions";
import { getSemanticBadgeClass } from "@/lib/ui/status-badge-styles";
import type {
  IntegrationHealthProvider,
  IntegrationHealthReport,
  IntegrationHealthStatus,
} from "@/services/integrations/integration-health/types";

const STATUS_UI: Record<
  IntegrationHealthStatus,
  { label: string; variant: Parameters<typeof getSemanticBadgeClass>[0] }
> = {
  CONNECTED: { label: "Conectado", variant: "success" },
  DEGRADED: { label: "Degradado", variant: "warning" },
  DISCONNECTED: { label: "Desconectado", variant: "neutral" },
  VERIFYING: { label: "Verificando", variant: "info" },
  NEEDS_ATTENTION: { label: "Requiere atención", variant: "danger" },
};

const PROVIDER_LABEL: Record<IntegrationHealthProvider, string> = {
  PRICELABS: "PriceLabs",
  TTLOCK: "TTLock",
  AIRBNB_ICAL: "Airbnb iCal",
  SIRE: "SIRE",
  TRAA: "TRAA",
};

export function IntegrationHealthSection({
  reports,
  canManage,
}: {
  reports: IntegrationHealthReport[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const anyRecoverable = reports.some(
    (r) => r.status !== "CONNECTED" && r.canRecover,
  );

  const recover = (provider?: IntegrationHealthProvider) => {
    startTransition(async () => {
      try {
        const res = await recoverIntegrationsAction(provider);
        if (res.ok) toast.success(res.message);
        else toast.error(res.message);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  if (reports.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Salud de conexiones</h2>
          <p className="text-xs text-muted-foreground">
            Estado unificado verificado con evidencia (no solo «conectado»).
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !anyRecoverable}
            onClick={() => recover()}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
            Recuperar conexiones
          </Button>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-border/60">
        {reports.map((r) => {
          const ui = STATUS_UI[r.status];
          return (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {PROVIDER_LABEL[r.provider]}
                  <Badge variant="outline" className={getSemanticBadgeClass(ui.variant)}>
                    {ui.label}
                  </Badge>
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {r.evidence.slice(0, 3).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              {canManage && r.status !== "CONNECTED" && r.canRecover ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={pending}
                  onClick={() => recover(r.provider)}
                >
                  Recuperar
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
