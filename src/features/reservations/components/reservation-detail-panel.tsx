"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteReservationAction } from "@/features/reservations/actions/reservation.actions";
import {
  formatStayRange,
  totalGuests,
} from "@/features/reservations/lib/reservation-dates";
import {
  displayStatusLabels,
  getStatusBadgeClass,
  resolveDisplayStatus,
} from "@/features/reservations/lib/reservation-status";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/helpers";
import { platformLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ReservationDetailPanelProps = {
  reservation: ReservationInboxItem;
  canWrite: boolean;
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
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value?.trim() || "—"}</span>
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
    <section className="space-y-3 border-b border-border pb-4 last:border-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ReservationDetailPanel({
  reservation,
  canWrite,
  onDeleted,
  onClose,
}: ReservationDetailPanelProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const displayStatus = resolveDisplayStatus(
    reservation.status,
    reservation.checkOut,
  );
  const guests = totalGuests(
    reservation.adults,
    reservation.children,
    reservation.infants,
  );

  async function handleDelete() {
    if (!confirm("¿Eliminar esta reserva?")) return;
    setDeleting(true);
    try {
      await deleteReservationAction(reservation.id);
      toast.success("Reserva eliminada");
      onDeleted(reservation.id);
      onClose();
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-4">
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase",
            getStatusBadgeClass(displayStatus),
          )}
        >
          {displayStatusLabels[displayStatus]}
        </span>
        <h3 className="mt-2 text-lg font-semibold leading-tight">
          {reservation.guestName}
        </h3>
        <p className="text-sm text-muted-foreground">{reservation.property.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <DetailSection title="Huésped">
          <DetailRow label="Nombre" value={reservation.guestFirstName} />
          <DetailRow label="Apellido" value={reservation.guestLastName} />
          <DetailRow label="Email" value={reservation.guestEmail} />
          <DetailRow label="Teléfono" value={reservation.guestPhone} />
          <DetailRow label="País" value={reservation.guestCountry} />
          <DetailRow label="Idioma" value={reservation.guestLanguage} />
        </DetailSection>

        <DetailSection title="Reserva">
          <DetailRow label="Propiedad" value={reservation.property.name} />
          <DetailRow
            label="Fechas"
            value={formatStayRange(reservation.checkIn, reservation.checkOut)}
          />
          <DetailRow
            label="Huéspedes"
            value={`${guests} total (${reservation.adults} adultos${
              reservation.children > 0 ? `, ${reservation.children} niños` : ""
            }${reservation.infants > 0 ? `, ${reservation.infants} bebés` : ""})`}
          />
          <DetailRow label="Notas" value={reservation.internalNotes} />
          <DetailRow label="Estado" value={displayStatusLabels[displayStatus]} />
          <DetailRow
            label="Total"
            value={formatCurrency(
              Number(reservation.totalAmount),
              reservation.currency,
            )}
          />
          <DetailRow label="Origen" value={platformLabels[reservation.platform]} />
        </DetailSection>
      </div>

      {canWrite ? (
        <div className="shrink-0 border-t border-border p-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar reserva
          </Button>
        </div>
      ) : null}
    </div>
  );
}
