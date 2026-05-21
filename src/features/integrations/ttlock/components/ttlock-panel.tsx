import {
  AccessCredentialDeliveryStatus,
  AccessCredentialStatus,
  TTLockExpirationStrategy,
} from "@prisma/client";
import {
  KeyRound,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { TTLockConnectionCard } from "@/features/integrations/ttlock/components/ttlock-connection-card";
import {
  refreshTTLockTokenAction,
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
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
  const { integration, properties, propertyLocks, metrics, canManage } = overview;
  const settings = integration.automationSettings;

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-pragma-soft lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Integraciones
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              TTLock Smart Access
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Base nativa para conectar cerraduras TTLock, mapear propiedades y
              preparar automatización de códigos cuando el registro de huéspedes
              esté completo.
            </p>
            {!overview.liveApiEnabled ? (
              <p className="mt-2 text-xs text-muted-foreground">
                API en modo preparación (sin llamadas live). Activa{" "}
                <code className="rounded bg-muted px-1">TTLOCK_API_ENABLED=true</code>{" "}
                cuando tengas credenciales reales.
              </p>
            ) : null}
          </div>
          <Badge variant="outline" className="self-start px-3 py-1">
            {metrics.integrationStatusLabel}
          </Badge>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Integración"
            value={metrics.integrationStatusLabel}
            detail="Estado global TTLock"
            icon={ShieldCheck}
          />
          <MetricCard
            label="Token"
            value={metrics.tokenHealthLabel}
            detail={`Expira: ${formatDate(integration.expiresAt)}`}
            icon={KeyRound}
          />
          <MetricCard
            label="Lock Sync"
            value={metrics.lockSyncLabel}
            detail={`Última sync: ${formatDate(integration.lastSyncedAt)}`}
            icon={RefreshCw}
          />
          <MetricCard
            label="Mapeos"
            value={metrics.mappingLabel}
            detail="Propiedades con lock asignado"
            icon={Link2}
          />
          <MetricCard
            label="Automatización"
            value={metrics.automationReadinessLabel}
            detail="Generación de códigos pendiente de API"
            icon={Zap}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <TTLockConnectionCard
            overview={overview}
            flashError={flashError}
            flashConnected={flashConnected}
          />

          <Card>
            <CardHeader>
              <CardTitle>Token Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Estado OAuth preparado para access/refresh token y UID.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {canManage ? (
                <form action={refreshTTLockTokenAction} className="pb-2">
                  <Button type="submit" variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4" />
                    Refrescar token
                  </Button>
                </form>
              ) : null}
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground">Access token</span>
                <span className="font-medium">{metrics.tokenHealthLabel}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground">Refresh token</span>
                <span className="font-medium">
                  {integration.hasRefreshToken ? "Guardado" : "Pendiente"}
                </span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground">UID</span>
                <span className="font-medium">{integration.uid ?? "Pendiente"}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground">Expiración</span>
                <span className="font-medium">{formatDate(integration.expiresAt)}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground">Último refresh</span>
                <span className="font-medium">
                  {formatDate(integration.lastTokenRefreshAt)}
                </span>
              </div>
              <div className="flex justify-between gap-3 rounded-xl bg-muted/40 p-3">
                <span className="text-muted-foreground">Salud conexión</span>
                <span className="font-medium">
                  {metrics.hasCredentials
                    ? metrics.hasTokens
                      ? "Credenciales + tokens"
                      : "Credenciales guardadas"
                    : "Sin credenciales"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lock Sync</CardTitle>
            <p className="text-sm text-muted-foreground">
              Lista preparada para locks TTLock. Sin API live, solo registra el
              estado de sincronización.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage ? (
            <form action={syncTTLockLocksAction} className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline">
                <RefreshCw className="h-4 w-4" />
                Sync Locks
              </Button>
              <Button type="submit" variant="outline" formAction={syncTTLockLocksAction}>
                Refresh Lock List
              </Button>
            </form>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-4 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Alias</span>
                <span>Lock ID</span>
                <span>Timezone</span>
                <span>Status</span>
              </div>
              {propertyLocks.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Sin locks mapeados todavía. Usa Property Mapping para vincular
                  cerraduras o espera la sync live de TTLock.
                </p>
              ) : (
                propertyLocks.map((lock) => (
                  <div
                    key={lock.id}
                    className="grid grid-cols-4 border-t border-border px-4 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {lock.alias ?? lock.property.name}
                    </span>
                    <span>{lock.ttlockLockId ?? "—"}</span>
                    <span>{lock.timezone ?? "—"}</span>
                    <span>
                      {lock.lockStatus} / {lock.onlineState}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property Mapping</CardTitle>
            <p className="text-sm text-muted-foreground">
              Vincula cada propiedad PRAGMA con su cerradura TTLock.
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
                    className="grid gap-3 rounded-xl border border-border p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
                  >
                    <input type="hidden" name="propertyId" value={property.id} />
                    <div>
                      <p className="text-sm font-semibold">{property.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {property.address}, {property.city}
                      </p>
                    </div>
                    <Input
                      name="ttlockLockId"
                      placeholder="TTLock Lock ID"
                      defaultValue={mapped?.ttlockLockId ?? ""}
                    />
                    <Input
                      name="alias"
                      placeholder="Alias"
                      defaultValue={mapped?.alias ?? ""}
                    />
                    <Input
                      name="timezone"
                      placeholder="Timezone"
                      defaultValue={mapped?.timezone ?? "America/Bogota"}
                    />
                    <Button type="submit" variant="outline">
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
            <CardTitle>Access Automation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configuración futura para generar códigos después del registro de
              huéspedes. No genera códigos todavía.
            </p>
          </CardHeader>
          <CardContent>
            <form action={saveTTLockAutomationSettingsAction} className="space-y-4">
              {[
                [
                  "generateAfterGuestRegistration",
                  "Generate access code after guest registration",
                  settings?.generateAfterGuestRegistration,
                ],
                [
                  "revokeAfterCheckout",
                  "Revoke code after checkout",
                  settings?.revokeAfterCheckout,
                ],
                [
                  "requireManualApproval",
                  "Manual approval before code generation",
                  settings?.requireManualApproval,
                ],
                ["autoSendCode", "Auto-send code (future)", settings?.autoSendCode],
                [
                  "allowRegeneration",
                  "Allow re-generation",
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
                <Label htmlFor="expirationStrategy">Lock expiration strategy</Label>
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
            <CardTitle>Reservation Access Foundation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="font-semibold">Access Credentials</p>
              <p className="mt-1 text-muted-foreground">
                {overview.accessCredentialCount} preparados
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {Object.values(AccessCredentialStatus).join(", ")}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="font-semibold">Delivery</p>
              <p className="mt-1 text-muted-foreground">
                Sin envíos automáticos aún
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {Object.values(AccessCredentialDeliveryStatus).join(", ")}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="font-semibold">Access Events</p>
              <p className="mt-1 text-muted-foreground">
                {overview.eventCount} eventos registrados
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Listo para TTLock logs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}
