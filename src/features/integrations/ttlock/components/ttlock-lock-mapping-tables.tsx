import { savePropertyLockMappingAction } from "@/features/integrations/ttlock/actions/ttlock.actions";
import {
  formatTTLockPropertyLabel,
  formatTTLockPropertyOption,
  sortTTLockProperties,
} from "@/features/integrations/ttlock/lib/ttlock-property-label";
import type { TTLockOverviewDto } from "@/services/integrations/ttlock/ttlock.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TTLockLockMappingTablesProps = {
  overview: TTLockOverviewDto;
  canManage: boolean;
};

function lockLabel(lock: TTLockOverviewDto["remoteLocks"][number]) {
  return lock.lockAlias ?? lock.lockName;
}

export function accountIsTTLockConnected(
  integration: TTLockOverviewDto["integration"],
) {
  return (
    integration.accountConnected &&
    integration.hasAccessToken &&
    (integration.status === "CONNECTED" || integration.status === "READY")
  );
}

function lockStatusBadge(
  integration: TTLockOverviewDto["integration"],
  mappedProperty: TTLockOverviewDto["properties"][number] | undefined,
) {
  if (!accountIsTTLockConnected(integration)) {
    return <Badge variant="outline">Sin conectar</Badge>;
  }
  if (mappedProperty) {
    return (
      <Badge variant="default" className="whitespace-nowrap bg-primary/90">
        Conectado · {formatTTLockPropertyLabel(mappedProperty)}
      </Badge>
    );
  }
  return <Badge variant="secondary">Disponible</Badge>;
}

export function TTLockSyncedLocksTable({
  overview,
  canManage,
}: TTLockLockMappingTablesProps) {
  const { integration, remoteLocks, properties, propertyLocks } = overview;
  const sortedProperties = sortTTLockProperties(properties);
  const connected = accountIsTTLockConnected(integration);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="hidden gap-2 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_88px_1.1fr_120px_68px] sm:px-4">
        <span>Cerradura</span>
        <span>ID</span>
        <span>Propiedad</span>
        <span>Estado</span>
        <span />
      </div>

      {remoteLocks.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">
          {connected
            ? "Sincroniza para cargar cerraduras de tu cuenta TTLock."
            : "Conecta TTLock y sincroniza para ver tus cerraduras."}
        </p>
      ) : (
        remoteLocks.map((lock) => {
          const mapped = propertyLocks.find((entry) => entry.ttlockLockId === lock.lockId);
          const mappedProperty = mapped
            ? properties.find((property) => property.id === mapped.propertyId)
            : undefined;

          return (
            <form
              key={lock.lockId}
              action={savePropertyLockMappingAction}
              className="flex flex-col gap-2 border-t border-border px-3 py-2.5 sm:grid sm:grid-cols-[1fr_88px_1.1fr_120px_68px] sm:items-center sm:gap-2 sm:px-4"
            >
              <input type="hidden" name="ttlockLockId" value={lock.lockId} />
              <input type="hidden" name="alias" value={lockLabel(lock)} />
              <input type="hidden" name="timezone" value="America/Bogota" />

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{lockLabel(lock)}</p>
                <p className="font-mono text-[11px] text-muted-foreground sm:hidden">
                  {lock.lockId}
                </p>
              </div>

              <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">
                {lock.lockId}
              </span>

              {canManage && connected ? (
                <select
                  name="propertyId"
                  defaultValue={mapped?.propertyId ?? ""}
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-xs"
                >
                  <option value="">Sin asignar</option>
                  {sortedProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatTTLockPropertyOption(property)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="truncate text-xs text-muted-foreground">
                  {mappedProperty
                    ? formatTTLockPropertyOption(mappedProperty)
                    : "—"}
                </span>
              )}

              <div className="flex items-center">
                {lockStatusBadge(integration, mappedProperty)}
              </div>

              {canManage && connected ? (
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full px-2 text-xs sm:w-auto"
                >
                  Guardar
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
            </form>
          );
        })
      )}
    </div>
  );
}

export function TTLockPropertyAssignmentTable({
  overview,
  canManage,
}: TTLockLockMappingTablesProps) {
  const { integration, remoteLocks, properties, propertyLocks } = overview;
  const sortedProperties = sortTTLockProperties(properties);
  const connected = accountIsTTLockConnected(integration);

  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay propiedades activas para mapear.
      </p>
    );
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Vista de solo lectura. Contacta a un administrador para editar mapeos.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1.1fr)_68px] gap-2 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-4">
        <span>Apto</span>
        <span>Propiedad</span>
        <span>Cerradura</span>
        <span />
      </div>

      {sortedProperties.map((property) => {
        const mapped = propertyLocks.find((lock) => lock.propertyId === property.id);
        const unit = property.unitNumber?.trim();

        return (
          <form
            key={property.id}
            action={savePropertyLockMappingAction}
            className="grid grid-cols-[56px_minmax(0,1fr)_minmax(0,1.1fr)_68px] items-center gap-2 border-t border-border px-3 py-1.5 sm:px-4"
          >
            <input type="hidden" name="propertyId" value={property.id} />
            <Input type="hidden" name="alias" value={mapped?.alias ?? ""} />
            <Input
              type="hidden"
              name="timezone"
              value={mapped?.timezone ?? "America/Bogota"}
            />

            <span className="text-sm font-semibold tabular-nums text-foreground">
              {unit || "—"}
            </span>
            <span className="truncate text-xs text-muted-foreground">{property.name}</span>

            <select
              name="ttlockLockId"
              defaultValue={mapped?.ttlockLockId ?? ""}
              disabled={!connected || remoteLocks.length === 0}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-xs disabled:opacity-50"
            >
              <option value="">
                {!connected
                  ? "Conecta TTLock"
                  : remoteLocks.length === 0
                    ? "Sincroniza"
                    : "Sin asignar"}
              </option>
              {remoteLocks.map((lock) => (
                <option key={lock.lockId} value={lock.lockId}>
                  {lockLabel(lock)}
                </option>
              ))}
            </select>

            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={!connected}
            >
              Guardar
            </Button>
          </form>
        );
      })}
    </div>
  );
}
