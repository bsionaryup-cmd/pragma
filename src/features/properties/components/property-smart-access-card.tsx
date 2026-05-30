"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { syncPropertySmartLockAction } from "@/features/integrations/ttlock/actions/ttlock-sync.actions";
import type { SmartLockSnapshot } from "@/modules/integrations/ttlock/ttlock.types";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/date";

type PropertySmartAccessCardProps = {
  propertyId: string;
  lock: SmartLockSnapshot | null;
  integrationConnected: boolean;
  canManage: boolean;
};

function onlineLabel(state: SmartLockSnapshot["onlineState"]) {
  switch (state) {
    case "ONLINE":
      return "En línea";
    case "OFFLINE":
      return "Fuera de línea";
    default:
      return "Desconocido";
  }
}

function SmartAccessRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-base text-foreground/85">{label}</span>
      <span className="min-w-0 text-right text-sm text-foreground/90">
        {value}
      </span>
    </div>
  );
}

export function PropertySmartAccessCard({
  propertyId,
  lock,
  integrationConnected,
  canManage,
}: PropertySmartAccessCardProps) {
  const [pending, startTransition] = useTransition();

  function onSync() {
    startTransition(async () => {
      try {
        const result = await syncPropertySmartLockAction(propertyId);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al sincronizar");
      }
    });
  }

  return (
    <section className="space-y-2 border-b border-border/60 pb-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Acceso inteligente
        </h4>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={pending || !integrationConnected}
            onClick={onSync}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Sync
          </Button>
        ) : null}
      </div>

      {!integrationConnected ? (
        <p className="text-sm text-muted-foreground">
          Conecta TTLock en Integraciones para gestionar cerraduras.
        </p>
      ) : !lock?.ttlockLockId ? (
        <p className="text-sm text-muted-foreground">
          Vincula el Lock ID TTLock en Integraciones → TTLock.
        </p>
      ) : (
        <div>
          <SmartAccessRow
            label="Cerradura"
            value={lock.alias ?? lock.ttlockLockId}
          />
          <SmartAccessRow label="Estado" value={onlineLabel(lock.onlineState)} />
          <SmartAccessRow
            label="Batería"
            value={lock.batteryLevel != null ? `${lock.batteryLevel}%` : "—"}
          />
          <SmartAccessRow
            label="Gateway"
            value={lock.gatewayId ?? (integrationConnected ? "Configurado" : "—")}
          />
          <SmartAccessRow
            label="Última sync"
            value={
              lock.lastSyncAt
                ? formatDateTime(lock.lastSyncAt, "—", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Nunca"
            }
          />
        </div>
      )}
    </section>
  );
}
