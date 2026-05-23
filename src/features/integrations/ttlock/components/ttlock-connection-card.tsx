"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import {
  disconnectTTLockAction,
  refreshTTLockTokenAction,
  syncTTLockLocksAction,
} from "@/features/integrations/ttlock/actions/ttlock.actions";
import type { TTLockOverviewDto } from "@/services/integrations/ttlock/ttlock.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TTLockConnectionCardProps = {
  overview: TTLockOverviewDto;
  flashError?: string | null;
  flashConnected?: boolean;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function TTLockConnectionCard({
  overview,
  flashError,
  flashConnected,
}: TTLockConnectionCardProps) {
  const { integration, canManage, metrics } = overview;
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConnected =
    integration.accountConnected &&
    (integration.status === "CONNECTED" || integration.status === "READY");
  const needsReconnect =
    integration.status === "TOKEN_EXPIRED" ||
    integration.status === "INVALID_CREDENTIALS" ||
    metrics.tokenHealth === "expired";
  const needsSync =
    isConnected &&
    (!integration.lastSyncedAt || integration.syncedLockCount === 0);

  const statusVariant =
    isConnected && !needsReconnect
      ? "default"
      : needsReconnect || integration.status === "SYNC_ERROR"
        ? "destructive"
        : "outline";

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            TTLock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="outline">{metrics.integrationStatusLabel}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!integration.platformConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            TTLock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            La integración TTLock estará disponible pronto. Contacta al soporte de
            PRAGMA si necesitas activarla.
          </p>
        </CardContent>
      </Card>
    );
  }

  function runSync() {
    setActionMessage(null);
    startTransition(async () => {
      try {
        await syncTTLockLocksAction();
        setActionMessage("Cerraduras sincronizadas correctamente.");
      } catch (error) {
        setActionMessage(
          error instanceof Error ? error.message : "No se pudo sincronizar",
        );
      }
    });
  }

  function runReconnect() {
    window.location.href = "/api/integrations/ttlock/connect";
  }

  return (
    <Card className="border-border shadow-pragma-soft">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </span>
            <div>
              <CardTitle>TTLock</CardTitle>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Conecta tu cuenta TTLock para gestionar cerraduras inteligentes
                dentro de PRAGMA.
              </p>
            </div>
          </div>
          <Badge variant={statusVariant}>{metrics.integrationStatusLabel}</Badge>
        </div>

        {flashConnected ? (
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            Cuenta TTLock conectada correctamente.
          </p>
        ) : null}
        {flashError ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {flashError}
          </p>
        ) : null}
        {integration.lastError ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {integration.lastError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground">
            {actionMessage}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cuenta
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {isConnected ? "Cuenta TTLock conectada" : "Sin conectar"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cerraduras
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {integration.syncedLockCount} sincronizadas
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Última sync
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formatDate(integration.lastSyncedAt)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estado
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {needsReconnect
                ? "Reconexión requerida"
                : needsSync
                  ? "Sync recomendada"
                  : metrics.integrationStatusLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isConnected || needsReconnect ? (
            <Button type="button" onClick={runReconnect} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              {needsReconnect ? "Reconectar TTLock" : "Conectar TTLock"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={runSync}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sincronizar cerraduras
              </Button>
              <form action={refreshTTLockTokenAction}>
                <Button type="submit" variant="outline" disabled={isPending}>
                  Refrescar sesión
                </Button>
              </form>
            </>
          )}
        </div>

        {isConnected ? (
          <div className="rounded-xl border border-border p-4">
            {!confirmDisconnect ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unplug className="h-4 w-4" />
                Desconectar
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  ¿Desconectar tu cuenta TTLock de esta organización? Los mapeos
                  guardados se mantienen, pero dejarás de sincronizar cerraduras.
                </p>
                <div className="flex flex-wrap gap-2">
                  <form action={disconnectTTLockAction}>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={isPending}
                    >
                      Confirmar desconexión
                    </Button>
                  </form>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmDisconnect(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
