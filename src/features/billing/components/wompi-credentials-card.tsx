"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  PlugZap,
} from "lucide-react";
import { toast } from "sonner";
import {
  revokeWompiCredentialsAction,
  saveWompiCredentialsAction,
  setWompiEnabledAction,
  testWompiConnectionAction,
} from "@/features/billing/actions/wompi.actions";
import type { WompiCredentialSnapshot } from "@/modules/billing/services/wompi-credentials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type WompiCredentialsCardProps = {
  wompi: WompiCredentialSnapshot;
  canManage: boolean;
};

const statusLabels: Record<WompiCredentialSnapshot["status"], string> = {
  missing: "Sin credenciales",
  stored: "Configurado en servidor",
  environment: "Variable de entorno",
  both: "BD + entorno (BD tiene prioridad)",
  disabled: "Desactivado",
};

function SecretField({
  id,
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Ocultar" : "Mostrar"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function WompiCredentialsCard({
  wompi,
  canManage,
}: WompiCredentialsCardProps) {
  const [editing, setEditing] = useState(!wompi.hasStoredCredentials);
  const [pending, startTransition] = useTransition();
  const [env, setEnv] = useState<"test" | "production">(wompi.env);
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [eventsSecret, setEventsSecret] = useState("");
  const [integritySecret, setIntegritySecret] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showIntegrity, setShowIntegrity] = useState(false);

  const onSave = () => {
    startTransition(async () => {
      try {
        const result = await saveWompiCredentialsAction({
          publicKey: publicKey.trim(),
          privateKey: privateKey.trim() || undefined,
          eventsSecret: eventsSecret.trim() || undefined,
          integritySecret: integritySecret.trim() || undefined,
          env,
        });
        if (result.ok) {
          toast.success(result.message);
          setPublicKey("");
          setPrivateKey("");
          setEventsSecret("");
          setIntegritySecret("");
          setEditing(false);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  const onRevoke = () => {
    if (!window.confirm("¿Revocar las credenciales Wompi almacenadas?")) return;
    startTransition(async () => {
      try {
        const result = await revokeWompiCredentialsAction();
        if (result.ok) {
          toast.success(result.message);
          setEditing(true);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  const onTest = () => {
    startTransition(async () => {
      try {
        const result = await testWompiConnectionAction();
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  const onToggleEnabled = (enabled: boolean) => {
    startTransition(async () => {
      try {
        const result = await setWompiEnabledAction(enabled);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  const copyWebhookUrl = async () => {
    if (!wompi.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(wompi.webhookUrl);
      toast.success("URL de webhook copiada");
    } catch {
      toast.error("No se pudo copiar la URL");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Configuración de pasarela Wompi (Plataforma)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">Estado</span>
          <span
            className={cn(
              "flex items-center gap-1.5 font-medium",
              wompi.configured ? "text-success" : "text-warning",
            )}
          >
            {wompi.configured ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {statusLabels[wompi.status]}
          </span>
        </div>

        {wompi.publicKeyHint ? (
          <p className="text-xs text-muted-foreground">
            Llave pública:{" "}
            <span className="font-mono">{wompi.publicKeyHint}</span>
            {wompi.privateKeyHint ? (
              <span className="ml-2">
                · Privada {wompi.privateKeyHint}
              </span>
            ) : null}
          </p>
        ) : null}

        {wompi.lastHealthCheckAt ? (
          <p className="text-xs text-muted-foreground">
            Última prueba:{" "}
            {new Date(wompi.lastHealthCheckAt).toLocaleString("es-CO")}
            {wompi.lastError ? (
              <span className="ml-1 text-red-600">· {wompi.lastError}</span>
            ) : null}
          </p>
        ) : null}

        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs">
          <p className="font-medium text-foreground">Webhook de eventos</p>
          <p className="mt-1 text-muted-foreground">
            Registra esta URL en tu dashboard Wompi (Eventos):
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-background px-2 py-1 font-mono text-[11px]">
              {wompi.webhookUrl ?? wompi.webhookPath}
            </code>
            {wompi.webhookUrl ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1"
                onClick={copyWebhookUrl}
              >
                <Copy className="h-3 w-3" />
                Copiar
              </Button>
            ) : null}
          </div>
        </div>

        {canManage && wompi.hasStoredCredentials ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <div>
              <p className="font-medium">Pagos en línea</p>
              <p className="text-xs text-muted-foreground">
                Activa o desactiva los pagos de suscripción PRAGMA vía Wompi
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={wompi.enabled ? "default" : "outline"}
              disabled={pending}
              onClick={() => onToggleEnabled(!wompi.enabled)}
            >
              {wompi.enabled ? "Activado" : "Desactivado"}
            </Button>
          </div>
        ) : null}

        {canManage ? (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            {wompi.hasStoredCredentials && !editing ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditing(true)}
                >
                  Actualizar credenciales
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={onTest}
                >
                  <PlugZap className="h-3.5 w-3.5" />
                  Probar conexión
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  disabled={pending}
                  onClick={onRevoke}
                >
                  Revocar
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="wompi-env">Entorno</Label>
                    <select
                      id="wompi-env"
                      value={env}
                      onChange={(e) =>
                        setEnv(e.target.value === "production" ? "production" : "test")
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      disabled={pending}
                    >
                      <option value="test">Pruebas (sandbox)</option>
                      <option value="production">Producción</option>
                    </select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="wompi-public-key">Llave pública</Label>
                    <Input
                      id="wompi-public-key"
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder={
                        wompi.publicKeyHint
                          ? `Actual: ${wompi.publicKeyHint}`
                          : "pub_test_..."
                      }
                      className="font-mono text-sm"
                      autoComplete="off"
                      disabled={pending}
                    />
                  </div>

                  <SecretField
                    id="wompi-private-key"
                    label="Llave privada"
                    value={privateKey}
                    onChange={setPrivateKey}
                    placeholder={
                      wompi.privateKeyHint
                        ? `Guardada (${wompi.privateKeyHint})`
                        : "prv_test_..."
                    }
                    show={showPrivate}
                    onToggleShow={() => setShowPrivate((v) => !v)}
                    disabled={pending}
                  />

                  <SecretField
                    id="wompi-events-secret"
                    label="Secreto de eventos (webhook)"
                    value={eventsSecret}
                    onChange={setEventsSecret}
                    placeholder={
                      wompi.eventsSecretHint
                        ? `Guardado (${wompi.eventsSecretHint})`
                        : "Pega el secreto de eventos"
                    }
                    show={showEvents}
                    onToggleShow={() => setShowEvents((v) => !v)}
                    disabled={pending}
                  />

                  <SecretField
                    id="wompi-integrity-secret"
                    label="Secreto de integridad"
                    value={integritySecret}
                    onChange={setIntegritySecret}
                    placeholder={
                      wompi.integritySecretHint
                        ? `Guardado (${wompi.integritySecretHint})`
                        : "Pega el secreto de integridad"
                    }
                    show={showIntegrity}
                    onToggleShow={() => setShowIntegrity((v) => !v)}
                    disabled={pending}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Las credenciales se cifran en el servidor. Nunca se envían al
                  navegador después de guardar.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={pending} onClick={onSave}>
                    Guardar credenciales
                  </Button>
                  {wompi.hasStoredCredentials ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={pending}
                        onClick={onTest}
                      >
                        <PlugZap className="h-3.5 w-3.5" />
                        Probar conexión
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          setPublicKey("");
                          setPrivateKey("");
                          setEventsSecret("");
                          setIntegritySecret("");
                          setEditing(false);
                        }}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo el Owner de plataforma puede configurar la pasarela Wompi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
