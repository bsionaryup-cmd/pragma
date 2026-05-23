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
  savePropertyLockMappingAction,
  saveTTLockAutomationSettingsAction,
  syncTTLockLocksAction,
} from "@/features/integrations/ttlock/actions/ttlock.actions";
import type { TTLockOverviewDto } from "@/services/integrations/ttlock/ttlock.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TTLockPanelProps = {
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
}: TTLockPanelProps) {
  const {
    integration,
    properties,
    propertyLocks,
    remoteLocks,
    metrics,
    canManage,
  } = overview;
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
            detail={`Última sync: ${formatDate(integration.lastSyncedAt)}`}
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
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
              Cerraduras sincronizadas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Lista de cerraduras detectadas en tu cuenta TTLock.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage ? (
              <form action={syncTTLockLocksAction}>
                <Button type="submit" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar cerraduras
                </Button>
              </form>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-3 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Nombre</span>
                <span>ID</span>
                <span>Estado</span>
              </div>
              {remoteLocks.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Conecta TTLock y pulsa &quot;Sincronizar cerraduras&quot; para
                  cargar tu inventario.
                </p>
              ) : (
                remoteLocks.map((lock) => {
                  const mapped = propertyLocks.find(
                    (entry) => entry.ttlockLockId === lock.lockId,
                  );
                  return (
                    <div
                      key={lock.lockId}
                      className="grid grid-cols-3 border-t border-border px-4 py-3 text-sm"
                    >
                      <span className="font-medium">
                        {lock.lockAlias ?? lock.lockName}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {lock.lockId}
                      </span>
                      <span>
                        {mapped
                          ? `Asignada · ${mapped.property.name}`
                          : "Disponible"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Asignar cerraduras a propiedades
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Vincula cada propiedad con una cerradura TTLock sincronizada.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay propiedades activas para mapear.
              </p>
            ) : canManage ? (
              properties.map((property) => {
                const mapped = propertyLocks.find(
                  (lock) => lock.propertyId === property.id,
                );
                return (
                  <form
                    key={property.id}
                    action={savePropertyLockMappingAction}
                    className="grid gap-3 rounded-xl border border-border p-4 lg:grid-cols-[1.2fr_1fr_auto]"
                  >
                    <input type="hidden" name="propertyId" value={property.id} />
                    <div>
                      <p className="text-sm font-semibold">{property.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {property.address}, {property.city}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`lock-${property.id}`}>Cerradura TTLock</Label>
                      <select
                        id={`lock-${property.id}`}
                        name="ttlockLockId"
                        defaultValue={mapped?.ttlockLockId ?? ""}
                        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                      >
                        <option value="">Sin asignar</option>
                        {remoteLocks.map((lock) => (
                          <option key={lock.lockId} value={lock.lockId}>
                            {lock.lockAlias ?? lock.lockName} ({lock.lockId})
                          </option>
                        ))}
                      </select>
                      <Input
                        name="alias"
                        type="hidden"
                        value={mapped?.alias ?? ""}
                      />
                      <Input
                        name="timezone"
                        type="hidden"
                        value={mapped?.timezone ?? "America/Bogota"}
                      />
                    </div>
                    <Button type="submit" variant="outline" className="self-end">
                      Guardar
                    </Button>
                  </form>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Vista de solo lectura. Contacta a un administrador para editar mapeos.
              </p>
            )}
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
