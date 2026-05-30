"use client";

import {
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { disconnectPropertyAirbnbIcalAction } from "@/features/properties/actions/airbnb-sync.actions";
import { deletePropertyAction } from "@/features/properties/actions/property.actions";
import { AirbnbSyncButton } from "@/features/properties/components/airbnb-sync-button";
import { PropertyIcalExportLink } from "@/features/properties/components/property-ical-export-link";
import { PropertySmartAccessCard } from "@/features/properties/components/property-smart-access-card";
import { PropertyCover } from "@/features/properties/components/property-cover";
import { getPropertyStatusBadgeClass } from "@/features/properties/lib/property-style";
import type { PropertyDetailDto } from "@/features/properties/types/property.types";
import { Button } from "@/components/ui/button";
import {
  propertyStatusLabels,
  propertyTypeLabels,
  reservationStatusLabels,
  taskTypeLabels,
} from "@/lib/labels";
import { formatCurrency } from "@/lib/helpers";
import { formatDateTime } from "@/lib/helpers/date";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { cn } from "@/lib/utils";

function PropertyDetailSection({
  title,
  children,
  headerAside,
  className,
}: {
  title: string;
  children: ReactNode;
  headerAside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-2 border-b border-border/60 pb-4 last:border-0",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {headerAside}
      </div>
      <div>{children}</div>
    </section>
  );
}

function PropertyMetaRow({
  label,
  value,
  children,
  emphasize,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-base text-foreground/85">{label}</span>
      {children ?? (
        <span
          className={cn(
            "min-w-0 text-right text-sm",
            emphasize ? "font-medium text-foreground" : "text-foreground/90",
          )}
        >
          {value?.trim() || "—"}
        </span>
      )}
    </div>
  );
}

function PropertyCompactListItem({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <li className="flex gap-2.5 border-b border-border/60 px-3 py-2 last:border-0 hover:bg-muted/20">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </li>
  );
}

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

  const capacityLabel = [
    `${property.maxGuests} huéspedes`,
    `${property.bedrooms} hab`,
    `${property.beds} camas`,
    `${property.bathrooms} baños`,
  ].join(" · ");

  const ratesLabel =
    [
      property.baseRate
        ? `Base ${formatCurrency(Number(property.baseRate), property.currency)}`
        : null,
      property.cleaningFee
        ? `Aseo ${formatCurrency(Number(property.cleaningFee), property.currency)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  const scheduleLabel = `Check-in ${property.checkInTime ?? "15:00"} · Check-out ${property.checkOutTime ?? "13:00"}`;

  const accessFields = [
    { label: "Instrucciones", value: property.accessInstructions },
    { label: "Código", value: property.accessCode },
    { label: "WiFi", value: property.wifiName },
    { label: "Clave WiFi", value: property.wifiPassword },
    { label: "Reglas", value: property.houseRules },
  ].filter((field) => field.value?.trim());

  const showAirbnbSection =
    property.airbnbListingUrl || hasIcalImport || property.lastIcalSyncedAt;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
        <div className="flex items-start gap-3">
          <PropertyCover
            id={property.id}
            name={property.name}
            coverImageUrl={property.coverImageUrl}
            className="h-16 w-20 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <PropertyIdentity
                name={property.name}
                unitNumber={property.unitNumber}
                size="sm"
              />
              <span
                className={cn(
                  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
                  getPropertyStatusBadgeClass(property.status),
                )}
              >
                {propertyStatusLabels[property.status]}
              </span>
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-foreground/70">
                {propertyTypeLabels[property.propertyType]}
              </span>
            </div>
            {locationLabel ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {locationLabel}
              </p>
            ) : null}
            <p className="mt-1.5 text-xs text-muted-foreground">{capacityLabel}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <span className="font-semibold tabular-nums text-foreground">
                {monthRevenue}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  ingresos mes
                </span>
              </span>
              <span className="text-muted-foreground" aria-hidden>
                ·
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {property.monthOccupancyPercent}%
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  ocupación
                </span>
              </span>
            </div>
          </div>
          {canWrite ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={onEdit}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-8 rounded-full border-danger/20 px-2.5 text-xs font-normal text-danger/70 hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Eliminar
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3">
        <PropertyDetailSection title="Datos">
          <PropertyMetaRow label="Dirección" value={property.address} />
          <PropertyMetaRow label="Horarios" value={scheduleLabel} />
          {ratesLabel ? (
            <PropertyMetaRow label="Tarifas" value={ratesLabel} emphasize />
          ) : null}
          {property.description?.trim() ? (
            <div className="py-1.5">
              <p className="text-base text-foreground/85">Descripción</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                {property.description}
              </p>
            </div>
          ) : null}
        </PropertyDetailSection>

        {accessFields.length > 0 ? (
          <PropertyDetailSection title="Acceso y WiFi">
            {accessFields.map((field) => (
              <PropertyMetaRow
                key={field.label}
                label={field.label}
                value={field.value}
                emphasize={field.label === "Código" || field.label === "Clave WiFi"}
              />
            ))}
          </PropertyDetailSection>
        ) : null}

        <PropertySmartAccessCard
          propertyId={property.id}
          lock={property.smartAccess?.lock ?? null}
          integrationConnected={property.smartAccess?.integrationConnected ?? false}
          canManage={canManageIntegrations}
        />

        {showAirbnbSection ? (
          <PropertyDetailSection title="Airbnb">
            <p
              className={cn(
                "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                hasIcalImport
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              {hasIcalImport
                ? "iCal activo · bloqueos se sincronizan con Airbnb (puede tardar unos minutos)."
                : "Sin iCal activo · bloqueos de Airbnb no se reflejan en PRAGMA."}
            </p>
            {property.airbnbListingUrl ? (
              <PropertyMetaRow label="Anuncio">
                <a
                  href={property.airbnbListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Ver en Airbnb
                </a>
              </PropertyMetaRow>
            ) : null}
            {property.lastIcalSyncedAt ? (
              <PropertyMetaRow
                label="Última sync"
                value={formatDateTime(property.lastIcalSyncedAt, "—", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            ) : null}
            {hasIcalImport && canWrite ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <AirbnbSyncButton
                  propertyId={property.id}
                  variant="detail"
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-danger/40 text-danger hover:bg-danger/10"
                  disabled={disconnecting}
                  onClick={handleDisconnectAirbnb}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Desconectando…
                    </>
                  ) : (
                    "Desconectar iCal"
                  )}
                </Button>
              </div>
            ) : null}
          </PropertyDetailSection>
        ) : null}

        {canWrite ? (
          <PropertyDetailSection title="Calendario export">
            <PropertyIcalExportLink propertyId={property.id} />
          </PropertyDetailSection>
        ) : null}

        <PropertyDetailSection
          title="Próximas reservas"
          headerAside={
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <Link href="/calendar">Calendario</Link>
            </Button>
          }
        >
          {property.upcomingReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin reservas próximas</p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-pragma-soft">
              {property.upcomingReservations.map((r) => (
                <PropertyCompactListItem
                  key={r.id}
                  title={r.guestName}
                  subtitle={`${r.checkIn} → ${r.checkOut} · ${reservationStatusLabels[r.status]}`}
                />
              ))}
            </ul>
          )}
        </PropertyDetailSection>

        <PropertyDetailSection title="Tareas pendientes">
          {property.pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tareas pendientes</p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-pragma-soft">
              {property.pendingTasks.map((t) => (
                <PropertyCompactListItem
                  key={t.id}
                  title={t.title}
                  subtitle={`${taskTypeLabels[t.type]}${
                    t.dueDate ? ` · ${t.dueDate.slice(0, 10)}` : ""
                  }`}
                />
              ))}
            </ul>
          )}
        </PropertyDetailSection>
      </div>
    </div>
  );
}
