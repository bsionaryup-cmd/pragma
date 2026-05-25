"use client";

import { useState, useTransition } from "react";
import { CreditCard, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  revokeTenantWompiCredentialsAction,
  saveTenantWompiCredentialsAction,
  setTenantWompiEnabledAction,
  testTenantWompiConnectionAction,
} from "@/features/integrations/wompi/actions/tenant-wompi.actions";
import type { WompiCredentialSnapshot } from "@/modules/billing/services/wompi-credentials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";

type TenantWompiPanelProps = {
  snapshot: WompiCredentialSnapshot;
  canManage: boolean;
};

export function TenantWompiPanel({ snapshot, canManage }: TenantWompiPanelProps) {
  const [pending, startTransition] = useTransition();
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [eventsSecret, setEventsSecret] = useState("");
  const [integritySecret, setIntegritySecret] = useState("");
  const [env, setEnv] = useState<"test" | "production">(snapshot.env);
  const [showSecrets, setShowSecrets] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await saveTenantWompiCredentialsAction({
        publicKey,
        privateKey: privateKey || undefined,
        eventsSecret: eventsSecret || undefined,
        integritySecret: integritySecret || undefined,
        env,
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
      title="Wompi del tenant"
      description="Cuenta del anfitrión para Payment Links. Separada de la suscripción SaaS de PRAGMA."
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CreditCard className="h-4 w-4 text-pragma-electric" />
          Estado: {snapshot.configured ? "Conectado" : "Pendiente"} · {snapshot.env}
        </div>
        <p className="text-xs text-muted-foreground">
          Webhook: usa el mismo endpoint global{" "}
          <code className="rounded bg-muted px-1">/api/payments/wompi/webhook</code> con
          referencias <code className="rounded bg-muted px-1">guest-&#123;linkId&#125;</code>
        </p>

        {canManage ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wompi-pub">Llave pública</Label>
              <Input
                id="wompi-pub"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder={snapshot.publicKeyHint ?? "pub_test_…"}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wompi-prv">Llave privada</Label>
              <Input
                id="wompi-prv"
                type={showSecrets ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Dejar vacío para no cambiar"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wompi-events">Secreto eventos</Label>
              <Input
                id="wompi-events"
                type={showSecrets ? "text" : "password"}
                value={eventsSecret}
                onChange={(e) => setEventsSecret(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wompi-int">Secreto integridad</Label>
              <Input
                id="wompi-int"
                type={showSecrets ? "text" : "password"}
                value={integritySecret}
                onChange={(e) => setIntegritySecret(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wompi-env">Entorno</Label>
              <select
                id="wompi-env"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={env}
                onChange={(e) =>
                  setEnv(e.target.value as "test" | "production")
                }
              >
                <option value="test">Test</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="brand" size="sm" disabled={pending} onClick={save}>
              Guardar credenciales
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await testTenantWompiConnectionAction();
                  toast[r.ok ? "success" : "error"](r.message);
                })
              }
            >
              Probar conexión
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSecrets((v) => !v)}
            >
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setTenantWompiEnabledAction(!snapshot.enabled);
                  toast[r.ok ? "success" : "error"](r.message);
                })
              }
            >
              {snapshot.enabled ? "Desactivar" : "Activar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await revokeTenantWompiCredentialsAction();
                  toast[r.ok ? "success" : "error"](r.message);
                })
              }
            >
              Revocar
            </Button>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
