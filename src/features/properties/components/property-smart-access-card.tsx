"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { syncPropertySmartLockAction } from "@/features/integrations/ttlock/actions/ttlock-sync.actions";
import type { SmartLockSnapshot } from "@/modules/integrations/ttlock/ttlock.types";
import { Button } from "@/components/ui/button";
import { DetailRow, DetailSection } from "@/components/detail/detail-section";

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
    <DetailSection
      title="Acceso inteligente"
      headerAside={
        canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !integrationConnected}
            onClick={onSync}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sincronizar
          </Button>
        ) : null
      }
    >
      {!integrationConnected ? (
        <p className="text-sm text-muted-foreground">
          Conecta TTLock en Integraciones para gestionar cerraduras de esta propiedad.
        </p>
      ) : !lock?.ttlockLockId ? (
        <p className="text-sm text-muted-foreground">
          Vincula el Lock ID TTLock de esta propiedad en Integraciones → TTLock.
        </p>
      ) : (
        <div className="space-y-2">
          <DetailRow label="Cerradura" value={lock.alias ?? lock.ttlockLockId} />
          <DetailRow
            label="Estado"
            value={onlineLabel(lock.onlineState)}
          />
          <DetailRow
            label="Batería"
            value={
              lock.batteryLevel != null ? `${lock.batteryLevel}%` : "—"
            }
          />
          <DetailRow
            label="Gateway"
            value={lock.gatewayId ?? integrationConnected ? "Configurado" : "—"}
          />
          <DetailRow
            label="Última sync"
            value={
              lock.lastSyncAt
                ? new Date(lock.lastSyncAt).toLocaleString("es-CO")
                : "Nunca"
            }
          />
        </div>
      )}
    </DetailSection>
  );
}
