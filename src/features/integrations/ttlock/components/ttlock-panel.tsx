import {
  AccessCredentialDeliveryStatus,
  AccessCredentialStatus,
  TTLockExpirationStrategy,
} from "@prisma/client";
import { KeyRound, Link2, LockKeyhole, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { TTLockConnectionCard } from "@/features/integrations/ttlock/components/ttlock-connection-card";
import {
  TTLockPropertyAssignmentTable,
  TTLockSyncedLocksTable,
} from "@/features/integrations/ttlock/components/ttlock-lock-mapping-tables";
import {
  saveTTLockAutomationSettingsAction,
  syncTTLockLocksAction,
} from "@/features/integrations/ttlock/actions/ttlock.actions";
import type { TTLockOverviewDto } from "@/services/integrations/ttlock/ttlock.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/helpers/date";

type TTLockPanelProps = {
  overview: TTLockOverviewDto;
  flashError?: string | null;
  flashConnected?: boolean;
  flashSynced?: boolean;
  flashSyncManual?: boolean;
  flashDisconnected?: boolean;
  flashMapped?: boolean;
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof LockKeyhole;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

export function TTLockPanel({
  overview,
  flashError,
  flashConnected,
  flashSynced,
  flashSyncManual,
  flashDisconnected,
  flashMapped,
}: TTLockPanelProps) {
  const { integration, metrics, canManage } = overview;
  const settings = integration.automationSettings;

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <BackLink href="/integrations" label="Integraciones" />
        <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-pragma-soft lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Integraciones
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              TTLock Smart Access
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Conecta tu cuenta TTLock, sincroniza cerraduras y asígnalas a tus
              propiedades para preparar accesos automatizados.
            </p>
          </div>
          <Badge variant="outline" className="self-start px-3 py-1">
            {metrics.integrationStatusLabel}
          </Badge>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Integración"
            value={metrics.integrationStatusLabel}
            detail="Estado de la conexión TTLock"
            icon={ShieldCheck}
          />
          <MetricCard
            label="Cerraduras"
            value={String(integration.syncedLockCount)}
            detail={`Última sync: ${formatDateTime(integration.lastSyncedAt, "Nunca")}`}
            icon={RefreshCw}
          />
          <MetricCard
            label="Mapeos"
            value={metrics.mappingLabel}
            detail="Propiedades con cerradura asignada"
            icon={Link2}
          />
          <MetricCard
            label="Automatización"
            value={metrics.automationReadinessLabel}
            detail="Preparado para códigos de acceso"
            icon={Zap}
          />
        </section>

        <TTLockConnectionCard
          overview={overview}
          flashError={flashError}
          flashConnected={flashConnected}
          flashSynced={flashSynced}
          flashSyncManual={flashSyncManual}
          flashDisconnected={flashDisconnected}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
              Cerraduras sincronizadas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Asigna cada cerradura a un apartamento. El estado muestra
              &quot;Conectado&quot; cuando la cuenta TTLock está activa y la
              cerradura quedó vinculada.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManage ? (
              <form action={syncTTLockLocksAction}>
                <Button type="submit" variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar cerraduras
                </Button>
              </form>
            ) : null}
            <TTLockSyncedLocksTable overview={overview} canManage={canManage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Asignar cerraduras a propiedades
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Listado compacto por número de apartamento (801, 802…).
            </p>
          </CardHeader>
          <CardContent>
            {flashMapped ? (
              <p className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                Asignación guardada correctamente.
              </p>
            ) : null}
            <TTLockPropertyAssignmentTable overview={overview} canManage={canManage} />
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Automatización de accesos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configura cuándo PRAGMA podrá generar códigos para huéspedes.
              </p>
            </CardHeader>
            <CardContent>
              <form action={saveTTLockAutomationSettingsAction} className="space-y-4">
                {[
                  [
                    "generateAfterGuestRegistration",
                    "Generar código tras registro de huéspedes",
                    settings?.generateAfterGuestRegistration,
                  ],
                  [
                    "revokeAfterCheckout",
                    "Revocar código al check-out",
                    settings?.revokeAfterCheckout,
                  ],
                  [
                    "requireManualApproval",
                    "Aprobación manual antes de generar",
                    settings?.requireManualApproval,
                  ],
                  ["autoSendCode", "Enviar código automáticamente", settings?.autoSendCode],
                  [
                    "allowRegeneration",
                    "Permitir regenerar código",
                    settings?.allowRegeneration,
                  ],
                ].map(([name, label, checked]) => (
                  <label
                    key={String(name)}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm"
                  >
                    <span>{label}</span>
                    <input
                      name={String(name)}
                      type="checkbox"
                      defaultChecked={Boolean(checked)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="expirationStrategy">Expiración del código</Label>
                  <select
                    id="expirationStrategy"
                    name="expirationStrategy"
                    defaultValue={
                      settings?.expirationStrategy ??
                      TTLockExpirationStrategy.CHECKOUT_TIME
                    }
                    className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                  >
                    {Object.values(TTLockExpirationStrategy).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Guardar automatización</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Base de accesos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="font-semibold">Credenciales</p>
              <p className="mt-1 text-muted-foreground">
                {overview.accessCredentialCount} preparadas
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="font-semibold">Entrega</p>
              <p className="mt-1 text-muted-foreground">Automatización futura</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {Object.values(AccessCredentialDeliveryStatus).join(", ")}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="font-semibold">Eventos</p>
              <p className="mt-1 text-muted-foreground">
                {overview.eventCount} registrados
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {Object.values(AccessCredentialStatus).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}
