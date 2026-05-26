"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  disableAirbnbEmailSyncAction,
  enableAirbnbEmailSyncAction,
  refreshAirbnbListingEmailMapsAction,
} from "@/features/integrations/airbnb/actions/airbnb-email-sync.actions";
import type { TenantAirbnbEmailIntegrationView } from "@/services/integrations/tenant-airbnb-email-integration.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/helpers/date";

type Props = {
  integration: TenantAirbnbEmailIntegrationView | null;
  canManage: boolean;
};

export function AirbnbEmailSyncCard({ integration, canManage }: Props) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(integration);

  function refreshMaps() {
    startTransition(async () => {
      const result = await refreshAirbnbListingEmailMapsAction();
      if (!result.success) {
        toast.error(result.error ?? "Error");
        return;
      }
      toast.success(`Mapas actualizados (${result.count ?? 0})`);
    });
  }

  function toggleEnabled() {
    if (!local) return;
    startTransition(async () => {
      if (local.enabled) {
        const result = await disableAirbnbEmailSyncAction();
        if (!result.success) {
          toast.error(result.error ?? "Error");
          return;
        }
        setLocal({ ...local, enabled: false, syncStatus: "DISABLED" });
        toast.success("Airbnb Email Sync desactivado");
        return;
      }

      const result = await enableAirbnbEmailSyncAction();
      if (!result.success || !result.integration) {
        toast.error(result.error ?? "Error");
        return;
      }
      setLocal(result.integration);
      toast.success("Airbnb Email Sync activado");
    });
  }

  if (!local) {
    return (
      <Card id="airbnb-email-sync">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Airbnb Email Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Recibe correos de Airbnb vía reenvío (Gmail → dominio inbound) y
            enriquece reservas sin reemplazar iCal.
          </p>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await enableAirbnbEmailSyncAction();
                  if (!result.success || !result.integration) {
                    toast.error(result.error ?? "Error");
                    return;
                  }
                  setLocal(result.integration);
                  toast.success("Integración creada");
                });
              }}
            >
              Configurar
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="airbnb-email-sync">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Airbnb Email Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Reenvía correos de Airbnb a la dirección inbound del tenant. PRAGMA
          clasifica eventos y enriquece reservas (código HM) sin crear reservas
          ni alterar iCal.
        </p>
        <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 font-mono text-xs">
          {local.inboundEmailAddress}
        </div>
        <dl className="grid gap-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Estado</dt>
            <dd className="font-medium text-foreground">{local.syncStatus}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Listings mapeados</dt>
            <dd>{local.listingMapCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Último correo</dt>
            <dd>
              {local.lastEmailReceivedAt
                ? formatDateTime(local.lastEmailReceivedAt)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Último procesado</dt>
            <dd>
              {local.lastProcessedAt
                ? formatDateTime(local.lastProcessedAt)
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Webhook Resend:{" "}
          <code className="text-[10px]">POST /api/webhooks/resend/inbound</code>{" "}
          (evento <code className="text-[10px]">email.received</code>)
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant={local.enabled ? "outline" : "brand"}
              disabled={pending}
              onClick={toggleEnabled}
            >
              {local.enabled ? "Desactivar" : "Activar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={refreshMaps}
            >
              Actualizar mapas
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
