"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  PlugZap,
} from "lucide-react";
import { toast } from "sonner";
import {
  revokePlatformEpaycoCredentialsAction,
  savePlatformEpaycoCredentialsAction,
  setPlatformEpaycoEnabledAction,
  testPlatformEpaycoConnectionAction,
} from "@/features/billing/actions/platform-epayco.actions";
import type { EpaycoCredentialSnapshot } from "@/modules/integrations/epayco/epayco-credentials";
import { formatDateTime } from "@/lib/helpers/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type EpaycoCredentialsCardProps = {
  epayco: EpaycoCredentialSnapshot;
  canManage: boolean;
};

export function EpaycoCredentialsCard({
  epayco,
  canManage,
}: EpaycoCredentialsCardProps) {
  const [editing, setEditing] = useState(!epayco.configured);
  const [pending, startTransition] = useTransition();
  const [env, setEnv] = useState<"test" | "production">(epayco.env);
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [pKey, setPKey] = useState("");
  const [custIdCliente, setCustIdCliente] = useState("");
  const [preferForSubscriptionPayments, setPreferForSubscriptionPayments] =
    useState(epayco.preferForSubscriptionPayments);
  const [showSecrets, setShowSecrets] = useState(false);

  const onSave = () => {
    startTransition(async () => {
      try {
        const result = await savePlatformEpaycoCredentialsAction({
          publicKey: publicKey.trim(),
          privateKey: privateKey.trim() || undefined,
          pKey: pKey.trim() || undefined,
          custIdCliente: custIdCliente.trim() || undefined,
          env,
          preferForSubscriptionPayments,
        });
        if (result.ok) {
          toast.success(result.message);
          setPublicKey("");
          setPrivateKey("");
          setPKey("");
          setCustIdCliente("");
          setEditing(false);
        } else {
          toast.error(result.message);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error inesperado");
      }
    });
  };

  const copyWebhookUrl = async () => {
    if (!epayco.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(epayco.webhookUrl);
      toast.success("URL de confirmación copiada");
    } catch {
      toast.error("No se pudo copiar la URL");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Configuración de pasarela ePayco (Plataforma)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">Estado</span>
          <span
            className={cn(
              "flex items-center gap-1.5 font-medium",
              epayco.configured ? "text-success" : "text-warning",
            )}
          >
            {epayco.configured ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {epayco.configured ? "Configurado" : "Pendiente"}
          </span>
        </div>

        {epayco.publicKeyHint ? (
          <p className="text-xs text-muted-foreground">
            Llave pública:{" "}
            <span className="font-mono">{epayco.publicKeyHint}</span>
          </p>
        ) : null}

        {epayco.lastHealthCheckAt ? (
          <p className="text-xs text-muted-foreground">
            Última prueba:{" "}
            {formatDateTime(epayco.lastHealthCheckAt, "—", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {epayco.lastError ? (
              <span className="ml-1 text-red-600">· {epayco.lastError}</span>
            ) : null}
          </p>
        ) : null}

        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs">
          <p className="font-medium text-foreground">Confirmación de pagos</p>
          <p className="mt-1 text-muted-foreground">
            Registra esta URL en tu dashboard ePayco:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-background px-2 py-1 font-mono text-[11px]">
              {epayco.webhookUrl ?? epayco.webhookPath}
            </code>
            {epayco.webhookUrl ? (
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

        {canManage && epayco.configured ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <div>
              <p className="font-medium">Suscripciones SaaS</p>
              <p className="text-xs text-muted-foreground">
                Activa o desactiva cobros de suscripción PRAGMA vía ePayco
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={epayco.enabled ? "default" : "outline"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setPlatformEpaycoEnabledAction(!epayco.enabled);
                  result.ok ? toast.success(result.message) : toast.error(result.message);
                })
              }
            >
              {epayco.enabled ? "Activado" : "Desactivado"}
            </Button>
          </div>
        ) : null}

        {canManage ? (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            {epayco.configured && !editing ? (
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
                  onClick={() =>
                    startTransition(async () => {
                      const result = await testPlatformEpaycoConnectionAction();
                      result.ok ? toast.success(result.message) : toast.error(result.message);
                    })
                  }
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
                  onClick={() => {
                    if (!window.confirm("¿Revocar las credenciales ePayco almacenadas?")) {
                      return;
                    }
                    startTransition(async () => {
                      const result = await revokePlatformEpaycoCredentialsAction();
                      if (result.ok) {
                        toast.success(result.message);
                        setEditing(true);
                      } else {
                        toast.error(result.message);
                      }
                    });
                  }}
                >
                  Revocar
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="platform-epayco-env">Entorno</Label>
                    <select
                      id="platform-epayco-env"
                      value={env}
                      onChange={(e) =>
                        setEnv(e.target.value === "production" ? "production" : "test")
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      disabled={pending}
                    >
                      <option value="test">Pruebas</option>
                      <option value="production">Producción</option>
                    </select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="platform-epayco-pub">Llave pública</Label>
                    <Input
                      id="platform-epayco-pub"
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder={epayco.publicKeyHint ?? "PUBLIC_KEY"}
                      className="font-mono text-sm"
                      disabled={pending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform-epayco-prv">Llave privada</Label>
                    <Input
                      id="platform-epayco-prv"
                      type={showSecrets ? "text" : "password"}
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder="Llave privada ePayco"
                      className="font-mono text-sm"
                      disabled={pending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform-epayco-pkey">P_KEY (confirmación)</Label>
                    <Input
                      id="platform-epayco-pkey"
                      type={showSecrets ? "text" : "password"}
                      value={pKey}
                      onChange={(e) => setPKey(e.target.value)}
                      placeholder="Dashboard ePayco → Confirmación"
                      className="font-mono text-sm"
                      disabled={pending}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="platform-epayco-cust">Cust ID cliente (opcional)</Label>
                    <Input
                      id="platform-epayco-cust"
                      value={custIdCliente}
                      onChange={(e) => setCustIdCliente(e.target.value)}
                      placeholder={epayco.custIdClienteHint ?? "ID comercio ePayco"}
                      className="font-mono text-sm"
                      disabled={pending}
                    />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">
                    <input
                      id="platform-epayco-prefer"
                      type="checkbox"
                      checked={preferForSubscriptionPayments}
                      onChange={(e) => setPreferForSubscriptionPayments(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                      disabled={pending}
                    />
                    <Label htmlFor="platform-epayco-prefer" className="font-normal">
                      Usar ePayco por defecto para suscripciones (si Wompi también está activo)
                    </Label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSecrets((v) => !v)}
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" size="sm" disabled={pending} onClick={onSave}>
                    Guardar credenciales
                  </Button>
                  {epayco.configured ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setEditing(false)}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo el Owner de plataforma puede configurar ePayco para suscripciones.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
