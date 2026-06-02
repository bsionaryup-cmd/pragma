"use client";

import { useState, useTransition } from "react";
import { CreditCard, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  revokeTenantEpaycoCredentialsAction,
  saveTenantEpaycoCredentialsAction,
  setTenantEpaycoEnabledAction,
  testTenantEpaycoConnectionAction,
} from "@/features/integrations/epayco/actions/tenant-epayco.actions";
import type { EpaycoCredentialSnapshot } from "@/modules/integrations/epayco/epayco-credentials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";

type TenantEpaycoPanelProps = {
  snapshot: EpaycoCredentialSnapshot;
  canManage: boolean;
};

export function TenantEpaycoPanel({ snapshot, canManage }: TenantEpaycoPanelProps) {
  const [pending, startTransition] = useTransition();
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [pKey, setPKey] = useState("");
  const [custIdCliente, setCustIdCliente] = useState("");
  const [env, setEnv] = useState<"test" | "production">(snapshot.env);
  const [preferForGuestPayments, setPreferForGuestPayments] = useState(
    snapshot.preferForGuestPayments,
  );
  const [showSecrets, setShowSecrets] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await saveTenantEpaycoCredentialsAction({
        publicKey,
        privateKey: privateKey || undefined,
        pKey: pKey || undefined,
        custIdCliente: custIdCliente || undefined,
        env,
        preferForGuestPayments,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <SectionCard
      title="ePayco del tenant"
      description="Cuenta del anfitrión para Payment Links. Separada de Wompi y de la suscripción SaaS de PRAGMA."
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4 text-pragma-electric" />
          Estado: {snapshot.configured ? "Conectado" : "Pendiente"} · {snapshot.env}
          {snapshot.preferForGuestPayments ? " · Preferido para cobros" : ""}
        </div>
        <p className="text-xs text-muted-foreground">
          Confirmación (webhook):{" "}
          <code className="rounded bg-muted px-1">/api/webhooks/epayco</code>
          <br />
          Respuesta al huésped: checkout en{" "}
          <code className="rounded bg-muted px-1">/pay/epayco/[linkId]</code>
          <br />
          Factura / referencia:{" "}
          <code className="rounded bg-muted px-1">guest-&#123;linkId&#125;</code>
        </p>

        {canManage ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="epayco-pub">Llave pública</Label>
              <Input
                id="epayco-pub"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={snapshot.publicKeyHint ?? "PUBLIC_KEY"}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="epayco-prv">Llave privada</Label>
              <Input
                id="epayco-prv"
                type={showSecrets ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Dejar vacío para no cambiar"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="epayco-pkey">P_KEY (confirmación)</Label>
              <Input
                id="epayco-pkey"
                type={showSecrets ? "text" : "password"}
                value={pKey}
                onChange={(e) => setPKey(e.target.value)}
                placeholder="Dashboard ePayco → Confirmación"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="epayco-cust">Cust ID cliente (opcional)</Label>
              <Input
                id="epayco-cust"
                value={custIdCliente}
                onChange={(e) => setCustIdCliente(e.target.value)}
                placeholder={snapshot.custIdClienteHint ?? "ID comercio ePayco"}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="epayco-env">Entorno</Label>
              <select
                id="epayco-env"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={env}
                onChange={(e) => setEnv(e.target.value as "test" | "production")}
              >
                <option value="test">Prueba</option>
                <option value="production">Producción</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="epayco-prefer"
                type="checkbox"
                checked={preferForGuestPayments}
                onChange={(e) => setPreferForGuestPayments(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="epayco-prefer" className="font-normal">
                Usar ePayco por defecto para Payment Links (si Wompi también está activo)
              </Label>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowSecrets((v) => !v)}>
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showSecrets ? "Ocultar" : "Mostrar"} secretos
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={save}>
                Guardar credenciales
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await testTenantEpaycoConnectionAction();
                    result.ok ? toast.success(result.message) : toast.error(result.message);
                  })
                }
              >
                Probar conexión
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setTenantEpaycoEnabledAction(!snapshot.enabled);
                    result.ok ? toast.success(result.message) : toast.error(result.message);
                  })
                }
              >
                {snapshot.enabled ? "Desactivar" : "Activar"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeTenantEpaycoCredentialsAction();
                    result.ok ? toast.success(result.message) : toast.error(result.message);
                  })
                }
              >
                Revocar
              </Button>
            </div>
          </div>
        ) : null}

        {snapshot.lastError ? (
          <p className="text-xs text-destructive">Último error: {snapshot.lastError}</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
