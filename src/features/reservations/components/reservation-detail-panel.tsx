"use client";

import { Copy, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  regenerateGuestRegistrationTokenAction,
  revokeGuestRegistrationTokenAction,
} from "@/features/guests/actions/guest-registration.actions";
import { deleteReservationAction } from "@/features/reservations/actions/reservation.actions";
import {
  countNights,
  formatStayRange,
  totalGuests,
} from "@/features/reservations/lib/reservation-dates";
import {
  displayStatusLabels,
  getStatusBadgeClass,
  resolveDisplayStatus,
} from "@/features/reservations/lib/reservation-status";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import { Button } from "@/components/ui/button";
import {
  DetailDrawerHero,
  DetailEmptyState,
  DetailListItem,
  DetailRow,
  DetailSection,
} from "@/components/detail/detail-section";
import { formatCurrency } from "@/lib/helpers";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import { cn } from "@/lib/utils";

type ReservationDetailPanelProps = {
  reservation: ReservationDetailItem;
  canWrite: boolean;
  canDelete?: boolean;
  onDeleted: (id: string) => void;
  onClose: () => void;
  /** false en calendario: no refrescar la página al eliminar */
  refreshAfterDelete?: boolean;
};

function formatReservationCode(reservation: ReservationDetailItem): string {
  if (reservation.icalUid?.trim()) return reservation.icalUid.trim();
  return reservation.id;
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const registrationStatusLabels = {
  ACTIVE: "Pendiente",
  COMPLETED: "Completado",
  EXPIRED: "Expirado",
  REVOKED: "Revocado",
} as const;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ReservationDetailPanel({
  reservation,
  canWrite,
  canDelete = false,
  onDeleted,
  onClose,
  refreshAfterDelete = true,
}: ReservationDetailPanelProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [isTokenPending, startTokenTransition] = useTransition();
  const displayStatus = resolveDisplayStatus(
    reservation.status,
    reservation.checkOut,
  );
  const nights = countNights(reservation.checkIn, reservation.checkOut);
  const guests = totalGuests(
    reservation.adults,
    reservation.children,
    reservation.infants,
  );
  const relatedBlocks = reservation.relatedBlocks ?? [];
  const registeredGuests = reservation.guests ?? [];
  const registration = reservation.guestRegistration;
  const reservationCode = formatReservationCode(reservation);

  async function handleDelete() {
    if (!confirm("¿Eliminar esta reserva?")) return;
    setDeleting(true);
    try {
      await deleteReservationAction(reservation.id);
      toast.success("Reserva eliminada");
      onDeleted(reservation.id);
      onClose();
      if (refreshAfterDelete) router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  async function copyRegistrationLink() {
    const url = registration?.url ?? reservation.guestRegistrationUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link de registro copiado");
  }

  function regenerateRegistrationLink() {
    startTokenTransition(async () => {
      try {
        const result = await regenerateGuestRegistrationTokenAction(reservation.id);
        await navigator.clipboard.writeText(result.url);
        toast.success("Nuevo link generado y copiado");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo regenerar el link",
        );
      }
    });
  }

  function revokeRegistrationLink() {
    if (!confirm("¿Revocar el link de registro de huéspedes?")) return;
    startTokenTransition(async () => {
      try {
        await revokeGuestRegistrationTokenAction(reservation.id);
        toast.success("Link de registro revocado");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo revocar el link",
        );
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      <DetailDrawerHero
        badge={
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase",
              getStatusBadgeClass(displayStatus),
            )}
          >
            {displayStatusLabels[displayStatus]}
          </span>
        }
        title={reservation.guestName}
        subtitle={reservation.property.name}
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <DetailSection title="Huésped">
          <DetailRow label="Huésped principal" value={reservation.guestName} />
          <DetailRow label="Email" value={reservation.guestEmail} />
          <DetailRow label="Teléfono" value={reservation.guestPhone} />
          <DetailRow label="País" value={reservation.guestCountry} />
          <DetailRow label="Idioma" value={reservation.guestLanguage} />
        </DetailSection>

        {registeredGuests.length > 0 ? (
          <DetailSection title="Registro completado">
            <div className="grid gap-2 sm:grid-cols-2">
              {registeredGuests.map((guest) => (
                <div
                  key={guest.id}
                  className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {guest.firstName} {guest.lastName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {guest.documentType} · {guest.documentNumber}
                  </p>
                </div>
              ))}
            </div>
          </DetailSection>
        ) : null}

        <DetailSection title="Reserva">
          <DetailRow label="Propiedad" value={reservation.property.name} />
          <DetailRow label="Check-in" value={reservation.checkIn} />
          <DetailRow label="Check-out" value={reservation.checkOut} />
          <DetailRow
            label="Estancia"
            value={`${formatStayRange(reservation.checkIn, reservation.checkOut)} · ${nights} ${nights === 1 ? "noche" : "noches"}`}
          />
          <DetailRow label="Estado" value={displayStatusLabels[displayStatus]} />
          <div className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-muted-foreground">Origen</span>
            <ReservationSourceBadge platform={reservation.platform} size="md" />
          </div>
          <DetailRow
            label="Total"
            value={formatCurrency(
              Number(reservation.totalAmount),
              reservation.currency,
            )}
          />
          <DetailRow
            label="Huéspedes"
            value={`${guests} total (${reservation.adults} adultos${
              reservation.children > 0 ? `, ${reservation.children} niños` : ""
            }${reservation.infants > 0 ? `, ${reservation.infants} bebés` : ""})`}
          />
          <DetailRow
            label={reservation.icalUid ? "Código iCal" : "Código PRAGMA"}
            value={reservationCode}
          />
          <DetailRow label="Notas" value={reservation.internalNotes} />
          {reservation.createdAt ? (
            <DetailRow
              label="Creada"
              value={formatCreatedAt(reservation.createdAt)}
            />
          ) : null}
        </DetailSection>

        <DetailSection title="Registro de huéspedes">
          {registration ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {registrationStatusLabels[registration.status]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Creado: {formatDateTime(registration.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expira: {formatDateTime(registration.expiresAt)}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-primary">
                  {registration.status}
                </span>
              </div>

              {registration.status === "ACTIVE" ? (
                <>
                  <a
                    href={registration.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {registration.url}
                  </a>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyRegistrationLink}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </Button>
                    {canWrite ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={regenerateRegistrationLink}
                          disabled={isTokenPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Regenerar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={revokeRegistrationLink}
                          disabled={isTokenPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Revocar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <DetailEmptyState>
                Esta reserva todavía no tiene link activo de registro.
              </DetailEmptyState>
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={regenerateRegistrationLink}
                  disabled={isTokenPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generar link
                </Button>
              ) : null}
            </div>
          )}
        </DetailSection>

        <DetailSection title="Lista de huéspedes">
          {registeredGuests.length > 0 ? (
            <ul className="space-y-2">
              {registeredGuests.map((guest) => (
                <li
                  key={guest.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {guest.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {guest.documentType} · {guest.documentNumber}
                      </p>
                    </div>
                    {guest.isPrimary ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Principal
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <DetailEmptyState>
              Registro de huéspedes pendiente. Se mostrará aquí cuando el
              huésped principal complete el formulario.
            </DetailEmptyState>
          )}
        </DetailSection>

        {relatedBlocks.length > 0 ? (
          <DetailSection title="Bloqueos relacionados">
            <ul className="space-y-2">
              {relatedBlocks.map((block) => (
                <li
                  key={block.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <p className="font-medium">{block.guestName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatStayRange(block.checkIn, block.checkOut)}
                  </p>
                </li>
              ))}
            </ul>
          </DetailSection>
        ) : null}
      </div>

      {canDelete ? (
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
