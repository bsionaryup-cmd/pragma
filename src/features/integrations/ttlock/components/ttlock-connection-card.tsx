"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Plug,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { TTLockEnvironment } from "@prisma/client";
import {
  disconnectTTLockAction,
  saveTTLockCredentialsAction,
  testTTLockConnectionAction,
} from "@/features/integrations/ttlock/actions/ttlock.actions";
import type { TTLockOverviewDto } from "@/services/integrations/ttlock/ttlock.types";
import { PRAGMA_CANONICAL_TTLOCK_CALLBACK } from "@/lib/integrations/ttlock-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TTLockConnectionCardProps = {
  overview: TTLockOverviewDto;
  flashError?: string | null;
  flashConnected?: boolean;
};

export function TTLockConnectionCard({
  overview,
  flashError,
  flashConnected,
}: TTLockConnectionCardProps) {
  const {
    integration,
    callbackUrl,
    callbackSource,
    callbackValidation,
    canManage,
    metrics,
    liveApiEnabled,
  } = overview;
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testSteps, setTestSteps] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const callbackReady = callbackValidation.valid && Boolean(callbackUrl);
  const displayCallback = callbackValidation.normalizedUrl ?? callbackUrl;

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conexión TTLock</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solo administradores pueden configurar esta integración.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
            <span className="text-muted-foreground">Estado</span>
            <Badge variant="outline">{metrics.integrationStatusLabel}</Badge>
          </div>
          {displayCallback ? (
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
              <span className="text-muted-foreground">Callback URL</span>
              <code className="max-w-[60%] truncate text-xs">{displayCallback}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  async function handleCopyCallback() {
    if (!displayCallback) return;
    try {
      await navigator.clipboard.writeText(displayCallback);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleTestConnection() {
    setTestMessage(null);
    setTestSteps(null);
    startTransition(async () => {
      const result = await testTTLockConnectionAction();
      setTestMessage(result.message);
      setTestSteps(result.steps ?? null);
    });
  }

  const statusVariant =
    integration.status === "CONNECTED" || integration.status === "READY"
      ? "default"
      : !callbackValidation.valid ||
          integration.status === "SYNC_ERROR" ||
          integration.status === "INVALID_CREDENTIALS" ||
          integration.status === "TOKEN_EXPIRED"
        ? "destructive"
        : "outline";

  return (
    <Card className="border-border shadow-pragma-soft">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Conexión TTLock
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra la callback exacta en TTLock Open Platform (EU). Fuente:{" "}
              <span className="font-medium text-foreground">{callbackSource}</span>
            </p>
          </div>
          <Badge variant={statusVariant}>{metrics.integrationStatusLabel}</Badge>
        </div>
        {flashConnected ? (
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            TTLock conectado correctamente.
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
        {!callbackValidation.valid ? (
          <div className="flex gap-2 rounded-xl border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Callback no válida para TTLock</p>
              <ul className="mt-1 list-inside list-disc text-xs opacity-90">
                {callbackValidation.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                En producción usa{" "}
                <code className="rounded bg-muted px-1 break-all">
                  {PRAGMA_CANONICAL_TTLOCK_CALLBACK}
                </code>
              </p>
            </div>
          </div>
        ) : null}
        {!liveApiEnabled ? (
          <p className="text-xs text-muted-foreground">
            API en modo preparación. Activa{" "}
            <code className="rounded bg-muted px-1">TTLOCK_API_ENABLED=true</code>{" "}
            para OAuth y pruebas live.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={saveTTLockCredentialsAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="callbackUrl">Callback URL (registrar en TTLock)</Label>
            <div className="flex gap-2">
              <Input
                id="callbackUrl"
                readOnly
                value={displayCallback || "—"}
                className={cn(
                  "font-mono text-xs",
                  !callbackReady && "border-amber-500/50",
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyCallback}
                disabled={!displayCallback}
                aria-label="Copiar callback URL"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {callbackReady ? (
              <p className="text-xs text-muted-foreground">
                Copia esta URL exacta en el portal TTLock → Redirect URI.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              name="clientId"
              required
              defaultValue={integration.clientId ?? ""}
              placeholder="App ID del portal TTLock"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <div className="relative">
              <Input
                id="clientSecret"
                name="clientSecret"
                type={showSecret ? "text" : "password"}
                placeholder={
                  integration.hasClientSecret
                    ? "Guardado (vacío = mantener)"
                    : "App Secret del portal TTLock"
                }
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label={showSecret ? "Ocultar secret" : "Mostrar secret"}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment">Entorno</Label>
            <select
              id="environment"
              name="environment"
              defaultValue={integration.environment}
              className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
            >
              <option value={TTLockEnvironment.PRODUCTION}>Producción (EU API)</option>
              <option value={TTLockEnvironment.SANDBOX}>Sandbox / pruebas</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>UID conectado</Label>
            <Input readOnly value={integration.uid ?? "—"} className="bg-muted/30" />
          </div>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              Guardar credenciales
            </Button>
            <Button
              asChild
              variant="default"
              disabled={!metrics.hasCredentials || !callbackReady}
            >
              <a href="/integrations/ttlock/connect">
                <Plug className="h-4 w-4" />
                Conectar cuenta
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              disabled={!metrics.hasCredentials || !callbackReady}
            >
              <a href="/api/integrations/ttlock/connect">OAuth navegador</a>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !metrics.hasCredentials}
              onClick={handleTestConnection}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Probar conexión
            </Button>
          </div>
        </form>

        <form action={disconnectTTLockAction}>
          <Button
            type="submit"
            variant="outline"
            disabled={isPending}
            className={cn(integration.status === "NOT_CONNECTED" && "opacity-60")}
          >
            <Unplug className="h-4 w-4" />
            Desconectar
          </Button>
        </form>

        {testMessage ? (
          <div className="space-y-2">
            <p
              className={cn(
                "rounded-xl px-3 py-2 text-sm",
                testMessage.toLowerCase().includes("válida")
                  ? "bg-primary/5 text-primary"
                  : "bg-destructive/5 text-destructive",
              )}
            >
              {testMessage}
            </p>
            {testSteps?.length ? (
              <ul className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {testSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
