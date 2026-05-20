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
import { deletePropertyAction } from "@/features/properties/actions/property.actions";
import { AirbnbSyncButton } from "@/features/properties/components/airbnb-sync-button";
import { PropertyIcalExportLink } from "@/features/properties/components/property-ical-export-link";
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
import { cn } from "@/lib/utils";

type PropertyDetailPanelProps = {
  property: PropertyDetailDto;
  canWrite: boolean;
  onEdit: () => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="divide-y divide-border/60 rounded-lg border border-border/60 px-3">
        {children}
      </div>
    </section>
  );
}

export function PropertyDetailPanel({
  property,
  canWrite,
  onEdit,
  onDeleted,
  onClose,
}: PropertyDetailPanelProps) {
  const router = useRouter();
  const [deleting, startDelete] = useTransition();

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

  return (
    <div className="flex h-full flex-col">
      <PropertyCover
        id={property.id}
        name={property.name}
        coverImageUrl={property.coverImageUrl}
        className="aspect-[16/9] w-full shrink-0"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase",
              getPropertyStatusBadgeClass(property.status),
            )}
          >
            {propertyStatusLabels[property.status]}
          </span>
          <h3 className="mt-2 text-lg font-semibold leading-tight">
            {property.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {[property.neighborhood, property.city, property.country]
              .filter(Boolean)
              .join(", ")}
          </p>
          {property.description ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {property.description}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              Ingresos del mes
            </p>
            <p className="mt-1 text-lg font-semibold">{monthRevenue}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Ocupación mes</p>
            <p className="mt-1 text-lg font-semibold">
              {property.monthOccupancyPercent}%
            </p>
          </div>
        </div>

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
            value={`Check-in ${property.checkInTime ?? "15:00"} · Check-out ${property.checkOutTime ?? "11:00"}`}
          />
          <DetailRow
            label="Tarifas"
            value={[
              property.baseRate
                ? `Base ${formatCurrency(Number(property.baseRate), property.currency)}`
                : null,
              property.cleaningFee
                ? `Limpieza ${formatCurrency(Number(property.cleaningFee), property.currency)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || null}
          />
        </DetailSection>

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

        {property.airbnbListingUrl || property.icalUrl ? (
          <DetailSection title="Airbnb">
            <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
              Los bloqueos se reflejarán en Airbnb por sincronización iCal
              (puede tardar unos minutos).
            </p>
            {property.airbnbListingUrl ? (
              <div className="flex justify-between gap-4 py-2 text-sm">
                <span className="text-muted-foreground">Anuncio</span>
                <a
                  href={property.airbnbListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-[60%] truncate text-right font-medium text-danger hover:underline"
                >
                  Ver en Airbnb
                </a>
              </div>
            ) : null}
            {property.icalUrl ? (
              <DetailRow label="iCal" value="Guardado para sincronización" />
            ) : null}
            {property.lastIcalSyncedAt ? (
              <DetailRow
                label="Última sync"
                value={new Date(property.lastIcalSyncedAt).toLocaleString("es-CO")}
              />
            ) : null}
            {property.icalUrl && canWrite ? (
              <div className="pt-2">
                <AirbnbSyncButton
                  propertyId={property.id}
                  variant="detail"
                  className="w-full"
                />
              </div>
            ) : null}
          </DetailSection>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Próximas reservas
            </h4>
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href={`/calendar`}>Ver calendario</Link>
            </Button>
          </div>
          {property.upcomingReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin reservas próximas</p>
          ) : (
            <ul className="space-y-2">
              {property.upcomingReservations.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{r.guestName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.checkIn} → {r.checkOut} ·{" "}
                    {reservationStatusLabels[r.status]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
            Tareas pendientes
          </h4>
          {property.pendingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tareas pendientes</p>
          ) : (
            <ul className="space-y-2">
              {property.pendingTasks.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {taskTypeLabels[t.type]}
                    {t.dueDate ? ` · ${t.dueDate.slice(0, 10)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canWrite ? (
        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
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
