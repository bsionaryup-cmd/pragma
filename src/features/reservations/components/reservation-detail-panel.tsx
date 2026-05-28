"use client";

import {
  Copy,
  Link2,
  Mail,
  Moon,
  Pencil,
  RefreshCw,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { AccessCodeDisplay } from "@/components/access/access-code-display";
import {
  generateGuestRegistrationLinkAction,
  regenerateGuestRegistrationTokenAction,
  resendGuestRegistrationEmailAction,
  revokeGuestRegistrationTokenAction,
} from "@/features/guests/actions/guest-registration.actions";
import { deleteReservationAction } from "@/features/reservations/actions/reservation.actions";
import { ReservationEditForm } from "@/features/reservations/components/reservation-edit-form";
import { getReservationEmailEnrichmentAction } from "@/features/reservations/actions/reservation-email-enrichment.actions";
import { dispatchDashboardDataRefresh } from "@/lib/dashboard-refresh";
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
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationGuestDto,
} from "@/features/reservations/types/reservation.types";
import { Button } from "@/components/ui/button";
import { DetailEmptyState } from "@/components/detail/detail-section";
import { formatCurrency } from "@/lib/helpers";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { ReservationPaymentLinks } from "@/features/payments/components/reservation-payment-links";
import { isGuestRegistrationDueSoon } from "@/lib/guest-registration-alert";
import { isReservationHoldActive } from "@/lib/reservations/reservation-hold";
import {
  formatHoldExpiryLabel,
  holdDepositPercentLabel,
} from "@/lib/reservations/reservation-hold-display";
import { formatPropertyLabel } from "@/lib/property-display";
import { isOtaImportedReservation } from "@/lib/reservations/reservation-ota";
import { buildAccessCodeGuestMessage } from "@/lib/access-code-guest-message";
import { getGuestDocumentTypeLabel } from "@/lib/guest-document-types";
import { cn } from "@/lib/utils";
import type { ReservationEmailEnrichmentDetail } from "@/services/reservations/reservation-email-enrichment.service";

function ReservationDetailSection({
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
        "space-y-2.5 border-b border-border/60 pb-5 last:border-0",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-base font-medium text-foreground/80">{title}</h4>
        {headerAside}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function ReservationMetaRow({
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

function ReservationStatusBadge({
  status,
  label,
}: {
  status: ReturnType<typeof resolveDisplayStatus>;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        getStatusBadgeClass(status),
      )}
    >
      {label}
    </span>
  );
}

type ReservationDetailPanelProps = {
  reservation: ReservationDetailItem;
  properties?: PropertyOption[];
  canWrite: boolean;
  canManageGuestRegistration?: boolean;
  canDelete?: boolean;
  canManagePayments?: boolean;
  onDeleted: (id: string) => void;
  onClose: () => void;
  onUpdated?: (reservation: ReservationDetailItem) => void;
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

const guestStatusLabels = {
  PENDING_REGISTRATION: "Pendiente",
  REGISTERED: "Registrado",
  VERIFIED: "Verificado",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
} as const;

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    dateStyle: "medium",
  });
}

function guestRoleLabel(guest: ReservationGuestDto): string | null {
  if (guest.isReservationOwner) return "Titular";
  if (guest.isPrimary) return "Principal";
  return null;
}

function TitularContactSummary({
  reservation,
}: {
  reservation: ReservationDetailItem;
}) {
  const contactLine = [reservation.guestEmail, reservation.guestPhone]
    .filter(Boolean)
    .join(" · ");
  const localeLine = [reservation.guestCountry, reservation.guestLanguage]
    .filter(Boolean)
    .join(" · ");

  if (!contactLine && !localeLine) return null;

  return (
    <div className="mt-1.5 space-y-0.5 text-base text-foreground/80">
      {contactLine ? <p className="break-words">{contactLine}</p> : null}
      {localeLine ? <p>{localeLine}</p> : null}
    </div>
  );
}

function RegisteredGuestsCompactList({
  guests,
}: {
  guests: ReservationGuestDto[];
}) {
  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card text-sm shadow-pragma-soft">
      {guests.map((guest, index) => {
        const role = guestRoleLabel(guest);
        const name =
          guest.fullName.trim() ||
          [guest.firstName, guest.lastName].filter(Boolean).join(" ");
        const documentLabel = getGuestDocumentTypeLabel(guest.documentType);
        const metaParts = [
          guest.email,
          guest.phone,
          guest.nationality,
          guest.dateOfBirth ? formatDateOnly(guest.dateOfBirth) : null,
        ].filter(Boolean);

        return (
          <li
            key={guest.id}
            className="flex gap-2.5 px-3 py-2.5 hover:bg-muted/20"
          >
            <span className="w-5 shrink-0 pt-0.5 text-center text-[10px] tabular-nums text-foreground/65">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium leading-tight text-foreground">
                  {name}
                </span>
                {role ? (
                  <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-foreground/65">
                    {role}
                  </span>
                ) : null}
                <span className="ml-auto text-[10px] text-foreground/65">
                  {guestStatusLabels[guest.status]}
                </span>
              </div>
              <p className="mt-0.5 text-base text-foreground/80">
                {documentLabel} · {guest.documentNumber}
              </p>
              {metaParts.length > 0 ? (
                <p className="mt-0.5 truncate text-[11px] text-foreground/65">
                  {metaParts.join(" · ")}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReservationDetailPanel({
  reservation,
  properties = [],
  canWrite,
  canManageGuestRegistration = canWrite,
  canDelete = false,
  canManagePayments = false,
  onDeleted,
  onClose,
  onUpdated,
  refreshAfterDelete = true,
}: ReservationDetailPanelProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [emailEnrichment, setEmailEnrichment] =
    useState<ReservationEmailEnrichmentDetail | null>(null);
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
  const registrationProgress = reservation.guestRegistrationProgress;
  const accessCode = reservation.accessCode;
  const reservationCode = formatReservationCode(reservation);
  const registrationDueSoon = isGuestRegistrationDueSoon({
    checkIn: reservation.checkIn,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
  });
  const holdActive = isReservationHoldActive({
    holdExpiresAt: reservation.holdExpiresAt,
    paymentStatus: reservation.paymentStatus,
  });
  const holdExpiryLabel = formatHoldExpiryLabel(reservation.holdExpiresAt);
  const propertyLabel = formatPropertyLabel(reservation.property);
  const otaImported = isOtaImportedReservation({
    platform: reservation.platform,
    icalUid: reservation.icalUid,
  });
  const allowDelete = canDelete && !otaImported;
  const allowManualEdit = canWrite && properties.length > 0 && reservation.platform !== "AIRBNB";
  const displayReservationId =
    reservation.platform === "AIRBNB"
      ? emailEnrichment?.reservationCodeFromEmail?.trim() || reservationCode
      : reservationCode;

  useEffect(() => {
    let cancelled = false;
    if (reservation.platform !== "AIRBNB") {
      setEmailEnrichment(null);
      return () => {
        cancelled = true;
      };
    }
    void getReservationEmailEnrichmentAction(reservation.id)
      .then((detail) => {
        if (!cancelled) setEmailEnrichment(detail);
      })
      .catch(() => {
        if (!cancelled) setEmailEnrichment(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reservation.id, reservation.platform]);

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
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de registro copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  async function copyRegistrationUrl(url: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(successMessage);
    } catch {
      toast.success(successMessage.replace(" y copiado", ""));
      toast.message("Copia el link manualmente desde el detalle de la reserva");
    }
  }

  function generateRegistrationLink() {
    startTokenTransition(async () => {
      const result = await generateGuestRegistrationLinkAction(reservation.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await copyRegistrationUrl(result.url, "Link generado y copiado");
      router.refresh();
      dispatchDashboardDataRefresh();
    });
  }

  function regenerateRegistrationLink() {
    startTokenTransition(async () => {
      const result = await regenerateGuestRegistrationTokenAction(reservation.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await copyRegistrationUrl(result.url, "Nuevo link generado y copiado");
      router.refresh();
      dispatchDashboardDataRefresh();
    });
  }

  function resendRegistrationEmail() {
    startTokenTransition(async () => {
      const result = await resendGuestRegistrationEmailAction(reservation.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Correo de registro reenviado al huésped");
    });
  }

  function revokeRegistrationLink() {
    if (!confirm("¿Revocar el link de registro de huéspedes?")) return;
    startTokenTransition(async () => {
      const result = await revokeGuestRegistrationTokenAction(reservation.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Link de registro revocado");
      router.refresh();
      dispatchDashboardDataRefresh();
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {holdActive ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-3">
          <p className="text-sm font-medium text-foreground">
            Reserva en espera de pago
          </p>
          <p className="mt-1 text-xs text-foreground/65">
            Las fechas están reservadas temporalmente (30 min). El huésped debe
            pagar al menos el depósito ({holdDepositPercentLabel()})
            {holdExpiryLabel ? ` — ${holdExpiryLabel.toLowerCase()}` : ""}. Si no
            paga, la disponibilidad se libera automáticamente.
          </p>
        </div>
      ) : null}

      {registrationDueSoon && canManageGuestRegistration && !holdActive ? (
        <div className="border-b border-pragma-cyan/30 bg-pragma-soft-cyan/30 px-5 py-3">
          <p className="text-sm font-medium text-foreground">
            Tu huésped llega pronto
          </p>
          <p className="mt-1 text-xs text-foreground/65">
            El check-in es en los próximos 2 días y aún falta el registro en{" "}
            {propertyLabel}. Comparte el enlace con calidez — un mensaje claro
            reduce fricción en la llegada.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="brand"
              disabled={isTokenPending}
              onClick={
                registration?.url || reservation.guestRegistrationUrl
                  ? regenerateRegistrationLink
                  : generateRegistrationLink
              }
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {registration?.url || reservation.guestRegistrationUrl
                ? "Regenerar link"
                : "Generar link"}
            </Button>
            {reservation.guestEmail?.trim() &&
            (registration?.url || reservation.guestRegistrationUrl) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isTokenPending}
                onClick={resendRegistrationEmail}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Reenviar por correo
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                isTokenPending ||
                !(registration?.url ?? reservation.guestRegistrationUrl)
              }
              onClick={async () => {
                const url = registration?.url ?? reservation.guestRegistrationUrl;
                if (!url) return;
                const welcome = [
                  `¡Hola${reservation.guestFirstName?.trim() ? ` ${reservation.guestFirstName.trim()}` : ""}! Nos alegra recibirte pronto.`,
                  "",
                  `Para tu estadía en ${propertyLabel}, completa el registro de huéspedes (datos y acceso) en este enlace seguro:`,
                  url,
                  "",
                  accessCode?.code
                    ? buildAccessCodeGuestMessage({
                        code: accessCode.code,
                        propertyName: reservation.property.name,
                        unitNumber: reservation.property.unitNumber,
                        propertyType: reservation.property.propertyType,
                        checkIn: reservation.checkIn,
                        checkOut: reservation.checkOut,
                        checkInTime: reservation.property.checkInTime,
                        checkOutTime: reservation.property.checkOutTime,
                      }) ?? ""
                    : "Cuando completes el registro, te compartiremos el código de acceso válido para tu estadía.",
                ]
                  .filter(Boolean)
                  .join("\n");
                await navigator.clipboard.writeText(welcome);
                toast.success("Mensaje de bienvenida copiado");
              }}
            >
              Copiar mensaje
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-0.5">
              <PropertyIdentity
                name={reservation.property.name}
                unitNumber={reservation.property.unitNumber}
                showName={false}
                size="lg"
                unitClassName="text-2xl font-bold"
              />
            </div>
            <h3 className="mt-2 text-3xl font-semibold leading-snug tracking-tight text-foreground">
              {reservation.guestName}
            </h3>
            <TitularContactSummary reservation={reservation} />
            <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold leading-relaxed text-foreground/85">
              {formatStayRange(reservation.checkIn, reservation.checkOut)}
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              <Moon className="h-4 w-4" aria-hidden />
              <span>{nights}</span>
            </p>
            <p className="mt-1 text-base font-semibold text-foreground/85">
              {reservation.platform === "AIRBNB" &&
              emailEnrichment?.guestCountTotal != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" aria-hidden />
                  <span>
                    {emailEnrichment.adultCount ?? 0} adultos
                    {(emailEnrichment.childCount ?? 0) > 0
                      ? `, ${emailEnrichment.childCount} niños`
                      : ""}
                    {(emailEnrichment.infantCount ?? 0) > 0
                      ? `, ${emailEnrichment.infantCount} bebés`
                      : ""}
                    {(emailEnrichment.petCount ?? 0) > 0
                      ? `, ${emailEnrichment.petCount} mascotas`
                      : ""}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" aria-hidden />
                  <span>
                    {reservation.adults} adultos
                    {reservation.children > 0 ? `, ${reservation.children} niños` : ""}
                    {reservation.infants > 0 ? `, ${reservation.infants} bebés` : ""}
                  </span>
                </span>
              )}
            </p>
            <div className="mt-1">
              <ReservationSourceBadge
                platform={reservation.platform}
                size="sm"
                showLabel={false}
              />
            </div>
          </div>
          <div className="mr-10 flex shrink-0 flex-col items-end gap-2">
            <p className="text-xs text-foreground/65">
              ID: <span className="font-medium text-foreground/80">{displayReservationId}</span>
            </p>
            {allowManualEdit || (allowDelete && !editing) ? (
              <div className="flex items-center gap-1.5">
              {allowManualEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setEditing((v) => !v)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {editing ? "Ver detalle" : "Editar"}
                </Button>
              ) : null}
              {allowDelete && !editing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-8 rounded-full border-danger/20 px-2.5 text-xs font-normal text-danger/70 hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  aria-label="Eliminar reserva"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </Button>
              ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {editing && canWrite && properties.length > 0 ? (
          <ReservationEditForm
            reservation={reservation}
            properties={properties}
            onSaved={(updated) => {
              setEditing(false);
              onUpdated?.(updated);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : null}

        {!editing ? (
          <>
            {accessCode ? (
              <ReservationDetailSection title="Código de acceso">
                <AccessCodeDisplay
                  code={accessCode.code}
                  status={accessCode.status}
                  isActive={accessCode.isActive}
                  copyContext={{
                    propertyType: reservation.property.propertyType,
                    propertyName: reservation.property.name,
                    unitNumber: reservation.property.unitNumber,
                    checkIn: reservation.checkIn,
                    checkOut: reservation.checkOut,
                    checkInTime: reservation.property.checkInTime,
                    checkOutTime: reservation.property.checkOutTime,
                  }}
                />
              </ReservationDetailSection>
            ) : null}

            <ReservationDetailSection title="Reserva">
              <div className="rounded-xl border border-border/80 bg-card px-3 py-1 shadow-pragma-soft">
                {reservation.createdAt ? (
                  <p className="py-1.5 text-xs text-foreground/65">
                    Creada:{" "}
                    <span className="font-medium text-foreground/80">
                      {formatCreatedAt(reservation.createdAt)}
                    </span>
                  </p>
                ) : null}
                <p className="py-1.5 text-sm text-foreground/80">
                  <span className="text-foreground/80">Cuánto pagó:</span>{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(
                      reservation.platform === "AIRBNB" &&
                        emailEnrichment?.guestTotalPaid != null
                        ? emailEnrichment.guestTotalPaid
                        : Number(reservation.totalAmount),
                      (reservation.platform === "AIRBNB"
                        ? emailEnrichment?.metadataCurrency
                        : null) ?? reservation.currency,
                    )}
                  </span>
                </p>
                {reservation.platform === "AIRBNB" &&
                emailEnrichment?.hostPayoutAmount != null ? (
                  <p className="py-1.5 text-sm text-foreground/80">
                    <span className="text-foreground/80">Gana anfitrión:</span>{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(
                        emailEnrichment.hostPayoutAmount,
                        emailEnrichment.metadataCurrency ?? reservation.currency,
                      )}
                    </span>
                  </p>
                ) : null}
              </div>
            </ReservationDetailSection>

            <ReservationDetailSection title="Huéspedes registrados">
              {registeredGuests.length > 0 ? (
                <RegisteredGuestsCompactList guests={registeredGuests} />
              ) : (
                <DetailEmptyState>
                  Registro de huéspedes pendiente. Los datos aparecerán aquí
                  cuando completen el formulario del link de registro.
                </DetailEmptyState>
              )}
            </ReservationDetailSection>

            {canManagePayments ? (
              <ReservationDetailSection title="Cobros">
                <ReservationPaymentLinks
                  reservationId={reservation.id}
                  canManage={canManagePayments}
                />
              </ReservationDetailSection>
            ) : null}

            <ReservationDetailSection title="Registro de huéspedes">
              {registrationProgress ? (
                <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">
                      {registrationProgress.registered} / {registrationProgress.capacity}
                    </span>{" "}
                    huéspedes registrados
                  </p>
                  <p className="mt-1 text-xs text-foreground/65">
                    Capacidad: {registrationProgress.capacity}{" "}
                    huésped{registrationProgress.capacity === 1 ? "" : "es"}
                    {!reservation.guestRegistrationCompletedAt &&
                    registrationProgress.registered < registrationProgress.capacity
                      ? " · faltan registros"
                      : null}
                  </p>
                </div>
              ) : null}
              {registration ? (
                <div className="space-y-3 rounded-xl border border-border/80 bg-card px-3 py-3 shadow-pragma-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {registrationStatusLabels[registration.status]}
                      </p>
                      <p className="mt-1 text-xs text-foreground/65">
                        Creado: {formatDateTime(registration.createdAt)}
                      </p>
                      <p className="text-xs text-foreground/65">
                        Expira: {formatDateTime(registration.expiresAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/65">
                      {registration.status}
                    </span>
                  </div>

                  {registration.status === "ACTIVE" ? (
                    <>
                      <a
                        href={registration.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all text-xs text-primary underline-offset-4 hover:underline"
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
                        {canManageGuestRegistration ? (
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
                  {canManageGuestRegistration ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateRegistrationLink}
                      disabled={isTokenPending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Generar link de registro de huéspedes
                    </Button>
                  ) : null}
                </div>
              )}
            </ReservationDetailSection>

            {relatedBlocks.length > 0 ? (
              <ReservationDetailSection title="Bloqueos relacionados">
                <ul className="space-y-2">
                  {relatedBlocks.map((block) => (
                    <li
                      key={block.id}
                      className="rounded-xl border border-border/80 bg-card px-3 py-2 text-sm shadow-pragma-soft"
                    >
                      <p className="font-medium text-foreground">{block.guestName}</p>
                      <p className="text-xs text-foreground/65">
                        {formatStayRange(block.checkIn, block.checkOut)}
                      </p>
                    </li>
                  ))}
                </ul>
              </ReservationDetailSection>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
