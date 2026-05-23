"use client";

import {
  CalendarDays,
  ClipboardList,
  DollarSign,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { disconnectPropertyAirbnbIcalAction } from "@/features/properties/actions/airbnb-sync.actions";
import { deletePropertyAction } from "@/features/properties/actions/property.actions";
import { AirbnbSyncButton } from "@/features/properties/components/airbnb-sync-button";
import { PropertyIcalExportLink } from "@/features/properties/components/property-ical-export-link";
import { PropertySmartAccessCard } from "@/features/properties/components/property-smart-access-card";
import { PropertyCover } from "@/features/properties/components/property-cover";
import { getPropertyStatusBadgeClass } from "@/features/properties/lib/property-style";
import type { PropertyDetailDto } from "@/features/properties/types/property.types";
import {
  DetailEmptyState,
  DetailListItem,
  DetailRow,
  DetailSection,
  DetailStatCard,
} from "@/components/detail/detail-section";
import { PropertyUnitBadge } from "@/components/properties/property-unit-badge";
import { Button } from "@/components/ui/button";
import { formatPropertyLabel } from "@/lib/property-display";
import {
  propertyStatusLabels,
  propertyTypeLabels,
  reservationStatusLabels,
  taskTypeLabels,
} from "@/lib/labels";
import { formatCurrency } from "@/lib/helpers";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { cn } from "@/lib/utils";

type PropertyDetailPanelProps = {
  property: PropertyDetailDto;
  canWrite: boolean;
  canManageIntegrations?: boolean;
  onEdit: () => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

export function PropertyDetailPanel({
  property,
  canWrite,
  canManageIntegrations = false,
  onEdit,
  onDeleted,
  onClose,
}: PropertyDetailPanelProps) {
  const router = useRouter();
  const [deleting, startDelete] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  function handleDisconnectAirbnb() {
    if (
      !confirm(
        "¿Desconectar el calendario Airbnb de esta propiedad? Se quitará el enlace iCal y se archivarán las reservas importadas desde Airbnb. Las reservas Directo/Booking no se tocan.",
      )
    ) {
      return;
    }
    startDisconnect(async () => {
      try {
        const { result } = await disconnectPropertyAirbnbIcalAction(property.id);
        const archived =
          result.cancelledReservations > 0
            ? ` · ${result.cancelledReservations} importación(es) archivada(s)`
            : "";
        toast.success(`Calendario Airbnb desconectado${archived}`);
        router.refresh();
        onClose();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo desconectar";
        toast.error(message);
      }
    });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar esta propiedad? No se puede deshacer.")) return;
    startDelete(async () => {
      try {
        await deletePropertyAction(property.id);
        toast.success("Propiedad eliminada");
        onDeleted(property.id);
        onClose();
        router.refresh();
      } catch {
        toast.error("No se pudo eliminar");
      }
    });
  }

  const monthRevenue = formatCurrency(
    Number(property.monthRevenue),
    property.currency,
  );
  const hasIcalImport = hasActiveAirbnbIcalImport(property.icalUrl);
  const locationLabel = [property.neighborhood, property.city, property.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-4 border-b border-border px-5 py-4">
        <PropertyCover
          id={property.id}
          name={property.name}
          coverImageUrl={property.coverImageUrl}
          className="h-24 w-32 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase",
              getPropertyStatusBadgeClass(property.status),
            )}
          >
            {propertyStatusLabels[property.status]}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <PropertyUnitBadge unitNumber={property.unitNumber} size="md" />
            <h3 className="text-lg font-semibold leading-tight">
              {formatPropertyLabel(property)}
            </h3>
          </div>
          {locationLabel ? (
            <p className="text-sm text-muted-foreground">{locationLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <DetailSection title="Resumen del mes">
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailStatCard
              label="Ingresos del mes"
              value={monthRevenue}
              icon={<DollarSign className="h-3.5 w-3.5" />}
            />
            <DetailStatCard
              label="Ocupación mes"
              value={`${property.monthOccupancyPercent}%`}
            />
          </div>
        </DetailSection>

        <DetailSection title="Información">
          <DetailRow
            label="Tipo"
            value={propertyTypeLabels[property.propertyType]}
          />
          <DetailRow
            label="Capacidad"
            value={`${property.maxGuests} huéspedes · ${property.bedrooms} hab · ${property.beds} camas · ${property.bathrooms} baños`}
          />
          <DetailRow label="Dirección" value={property.address} />
          <DetailRow
            label="Horarios"
            value={`Check-in ${property.checkInTime ?? "15:00"} · Check-out ${property.checkOutTime ?? "13:00"}`}
          />
          <DetailRow
            label="Tarifas"
            value={
              [
                property.baseRate
                  ? `Base ${formatCurrency(Number(property.baseRate), property.currency)}`
                  : null,
                property.cleaningFee
                  ? `Limpieza ${formatCurrency(Number(property.cleaningFee), property.currency)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || null
            }
          />
          <DetailRow label="Descripción" value={property.description} />
        </DetailSection>

        <PropertySmartAccessCard
          propertyId={property.id}
          lock={property.smartAccess?.lock ?? null}
          integrationConnected={property.smartAccess?.integrationConnected ?? false}
          canManage={canManageIntegrations}
        />

        <DetailSection title="Operación">
          <DetailRow label="Acceso" value={property.accessInstructions} />
          <DetailRow label="Código" value={property.accessCode} />
          <DetailRow label="WiFi" value={property.wifiName} />
          <DetailRow label="Clave WiFi" value={property.wifiPassword} />
          <DetailRow label="Reglas" value={property.houseRules} />
        </DetailSection>

        {canWrite ? (
          <DetailSection title="Exportar calendario">
            <PropertyIcalExportLink propertyId={property.id} />
          </DetailSection>
        ) : null}

        {property.airbnbListingUrl || hasIcalImport ? (
          <DetailSection title="Airbnb">
            {hasIcalImport ? (
              <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
                Los bloqueos se reflejarán en Airbnb por sincronización iCal
                (puede tardar unos minutos).
              </p>
            ) : (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Sin importación iCal activa. Los bloqueos de Airbnb no se
                sincronizan ni se muestran en PRAGMA.
              </p>
            )}
            {property.airbnbListingUrl ? (
              <DetailRow label="Anuncio">
                <a
                  href={property.airbnbListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Ver en Airbnb
                </a>
              </DetailRow>
            ) : null}
            {hasIcalImport ? (
              <DetailRow label="iCal" value="Guardado para sincronización" />
            ) : null}
            {property.lastIcalSyncedAt ? (
              <DetailRow
                label="Última sync"
                value={new Date(property.lastIcalSyncedAt).toLocaleString(
                  "es-CO",
                )}
              />
            ) : null}
            {hasIcalImport && canWrite ? (
              <div className="space-y-2">
                <AirbnbSyncButton
                  propertyId={property.id}
                  variant="detail"
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-danger/40 text-danger hover:bg-danger/10"
                  disabled={disconnecting}
                  onClick={handleDisconnectAirbnb}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Desconectando…
                    </>
                  ) : (
                    "Desconectar calendario Airbnb"
                  )}
                </Button>
              </div>
            ) : null}
          </DetailSection>
        ) : null}

        <DetailSection
          title="Próximas reservas"
          headerAside={
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href="/calendar">Ver calendario</Link>
            </Button>
          }
        >
          {property.upcomingReservations.length === 0 ? (
            <DetailEmptyState>Sin reservas próximas</DetailEmptyState>
          ) : (
            <ul className="space-y-2">
              {property.upcomingReservations.map((r) => (
                <DetailListItem
                  key={r.id}
                  title={r.guestName}
                  subtitle={`${r.checkIn} → ${r.checkOut} · ${reservationStatusLabels[r.status]}`}
                />
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection title="Tareas pendientes">
          {property.pendingTasks.length === 0 ? (
            <DetailEmptyState>Sin tareas pendientes</DetailEmptyState>
          ) : (
            <ul className="space-y-2">
              {property.pendingTasks.map((t) => (
                <DetailListItem
                  key={t.id}
                  title={t.title}
                  subtitle={`${taskTypeLabels[t.type]}${
                    t.dueDate ? ` · ${t.dueDate.slice(0, 10)}` : ""
                  }`}
                />
              ))}
            </ul>
          )}
        </DetailSection>
      </div>

      {canWrite ? (
        <div className="flex shrink-0 gap-2 border-t border-border p-4">
          <Button variant="outline" className="flex-1" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Eliminar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
