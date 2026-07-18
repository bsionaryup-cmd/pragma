"use client";

import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  completeGuestRegistrationAction,
  registerGuestStepAction,
} from "@/features/guests/actions/guest-registration.actions";
import { GuestPlaceFields } from "@/features/guests/components/guest-place-fields";
import {
  documentTypes,
  type GuestStepValues,
} from "@/features/guests/schemas/guest-registration.schema";
import {
  GUEST_SEX_CODES,
  GUEST_TRAVEL_MOTIVE_CODES,
  ISO_COUNTRIES,
  guestSexLabels,
  guestTravelMotiveLabels,
} from "@/lib/guest-registration/canonical-guest-catalogs";
import {
  GUEST_HABEAS_DATA_SUMMARY_ES,
  GUEST_LODGING_CONTRACT_SUMMARY_ES,
  GUEST_HABEAS_DATA_POLICY_VERSION,
  GUEST_LODGING_CONTRACT_VERSION,
} from "@/lib/guest-registration/guest-legal-versions";
import {
  getGuestDocumentTypeLabel,
  guestDocumentTypeLabels,
} from "@/lib/guest-document-types";
import type { GuestRegistrationReservation } from "@/services/guests/guest-registration.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

type WizardStep = "intro" | "register" | "hub" | "confirm" | "success";

function emptyGuestForm(
  seed?: Partial<Omit<GuestStepValues, "token">>,
): Omit<GuestStepValues, "token"> {
  return {
    firstName: seed?.firstName ?? "",
    lastName: seed?.lastName ?? "",
    documentType: seed?.documentType ?? "CC",
    documentNumber: seed?.documentNumber ?? "",
    email: seed?.email ?? "",
    phone: seed?.phone ?? "",
    nationality: seed?.nationality ?? "CO",
    dateOfBirth: seed?.dateOfBirth ?? "",
    sex: seed?.sex ?? "M",
    travelMotive: seed?.travelMotive ?? "LEISURE",
    occupation: seed?.occupation ?? "",
    residenceCountry: seed?.residenceCountry ?? "CO",
    residenceAdminArea: seed?.residenceAdminArea ?? "",
    residenceCity: seed?.residenceCity ?? "",
    originCountry: seed?.originCountry ?? "CO",
    originAdminArea: seed?.originAdminArea ?? "",
    originCity: seed?.originCity ?? "",
    destinationCountry: seed?.destinationCountry ?? "CO",
    destinationAdminArea: seed?.destinationAdminArea ?? "",
    destinationCity: seed?.destinationCity ?? "",
  };
}

function splitHolderName(name: string | null): { firstName: string; lastName: string } {
  if (!name?.trim()) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

function resolveInitialStep(
  reservation: GuestRegistrationReservation,
): WizardStep {
  if (reservation.completedAt) return "success";
  if (reservation.registeredCount > 0) return "hub";
  return "intro";
}

const selectClassName =
  "h-10 w-full rounded-xl border border-input bg-white px-3.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-card";

export function GuestRegistrationForm({
  reservation: initialReservation,
}: {
  reservation: GuestRegistrationReservation;
}) {
  const [reservation, setReservation] =
    useState<GuestRegistrationReservation>(initialReservation);
  const [step, setStep] = useState<WizardStep>(() =>
    resolveInitialStep(initialReservation),
  );
  const [form, setForm] = useState(() => {
    const seed = splitHolderName(initialReservation.holderDisplayName);
    return emptyGuestForm(
      initialReservation.registeredCount === 0
        ? { firstName: seed.firstName, lastName: seed.lastName }
        : undefined,
    );
  });
  const [acceptLodging, setAcceptLodging] = useState(false);
  const [acceptHabeas, setAcceptHabeas] = useState(false);
  const [nationalityQuery, setNationalityQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const isOwnerStep = reservation.registeredCount === 0;
  const canAddMore = reservation.registeredCount < reservation.maxCapacity;
  const progressLabel = `${reservation.registeredCount} / ${reservation.maxCapacity}`;

  const registeredGuests = useMemo(
    () => reservation.guests.filter((guest) => guest.status !== "PENDING_REGISTRATION"),
    [reservation.guests],
  );

  const filteredNationalities = useMemo(() => {
    const q = nationalityQuery.trim().toLowerCase();
    if (!q) return ISO_COUNTRIES;
    return ISO_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q),
    );
  }, [nationalityQuery]);

  function updateForm(patch: Partial<Omit<GuestStepValues, "token">>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function openRegisterStep() {
    if (reservation.registeredCount === 0) {
      const seed = splitHolderName(reservation.holderDisplayName);
      setForm(emptyGuestForm({ firstName: seed.firstName, lastName: seed.lastName }));
    } else {
      setForm(emptyGuestForm());
    }
    setNationalityQuery("");
    setStep("register");
  }

  function handleRegisterGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await registerGuestStepAction({
        token: reservation.token,
        ...form,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setReservation(result.reservation);
      setForm(emptyGuestForm());
      setStep("hub");
      toast.success(
        isOwnerStep
          ? "Titular de la reserva registrado"
          : "Huésped registrado correctamente",
      );
    });
  }

  function handleCompleteRegistration() {
    if (!acceptLodging || !acceptHabeas) {
      toast.error("Debes aceptar el contrato y la autorización de datos");
      return;
    }
    startTransition(async () => {
      const result = await completeGuestRegistrationAction({
        token: reservation.token,
        confirmAllGuests: true,
        acceptLodgingContract: true,
        acceptHabeasData: true,
        locale: "es-CO",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setReservation(result.reservation);
      setStep("success");
      toast.success("Registro completado");
    });
  }

  if (step === "success") {
    return (
      <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Registro completado
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Registraste {registeredGuests.length} huésped
          {registeredGuests.length === 1 ? "" : "es"}. El anfitrión ya puede
          ver la información en PRAGMA y preparar tu acceso.
        </p>
      </section>
    );
  }

  if (step === "intro") {
    return (
      <section className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Registra a quienes se hospedarán
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Esta propiedad admite hasta{" "}
                <strong>{reservation.maxCapacity}</strong> huésped
                {reservation.maxCapacity === 1 ? "" : "es"}. Registra al titular
                primero y luego agrega acompañantes. Solo te pediremos estos
                datos una vez.
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          className="h-11 w-full"
          onClick={openRegisterStep}
        >
          <UserPlus className="h-4 w-4" />
          Comenzar registro
        </Button>
      </section>
    );
  }

  if (step === "hub") {
    return (
      <section className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Progreso: {progressLabel} huéspedes registrados
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Capacidad de la reserva: {reservation.maxCapacity}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-sm font-semibold text-warning">
              <ShieldCheck className="h-4 w-4" />
              En progreso
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {registeredGuests.map((guest, index) => (
            <div
              key={guest.id}
              className="rounded-xl border border-border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {guest.fullName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getGuestDocumentTypeLabel(guest.documentType)} ·{" "}
                    {guest.documentNumber}
                  </p>
                </div>
                {guest.isReservationOwner ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                    Titular
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    Huésped {index + 1}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {canAddMore ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={openRegisterStep}
            >
              <Plus className="h-4 w-4" />
              Agregar otro huésped
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-11"
            onClick={() => setStep("confirm")}
            disabled={registeredGuests.length === 0}
          >
            Finalizar registro
          </Button>
        </div>
      </section>
    );
  }

  if (step === "confirm") {
    return (
      <section className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <h2 className="text-lg font-semibold text-foreground">
            Confirma huéspedes y acepta términos
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Registraste {registeredGuests.length} de máximo{" "}
            {reservation.maxCapacity}. Al confirmar, guardamos tu aceptación
            del contrato de hospedaje y la autorización de datos (Habeas Data).
          </p>
        </div>

        <ul className="space-y-2">
          {registeredGuests.map((guest) => (
            <li
              key={guest.id}
              className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground"
            >
              {guest.fullName}
            </li>
          ))}
        </ul>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-input"
              checked={acceptLodging}
              onChange={(e) => setAcceptLodging(e.target.checked)}
            />
            <span>
              <span className="font-semibold">
                Acepto el contrato de hospedaje
              </span>{" "}
              <span className="text-muted-foreground">
                (v{GUEST_LODGING_CONTRACT_VERSION}). {GUEST_LODGING_CONTRACT_SUMMARY_ES}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-input"
              checked={acceptHabeas}
              onChange={(e) => setAcceptHabeas(e.target.checked)}
            />
            <span>
              <span className="font-semibold">
                Autorizo el tratamiento de datos personales
              </span>{" "}
              <span className="text-muted-foreground">
                (v{GUEST_HABEAS_DATA_POLICY_VERSION}). {GUEST_HABEAS_DATA_SUMMARY_ES}
              </span>
            </span>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setStep("hub")}
            disabled={isPending}
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={handleCompleteRegistration}
            disabled={isPending || !acceptLodging || !acceptHabeas}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar y finalizar
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={handleRegisterGuest} className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
        <p className="text-sm font-semibold text-foreground">
          {isOwnerStep
            ? "Titular de la reserva"
            : `Huésped ${reservation.registeredCount + 1}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOwnerStep
            ? "Registra tus datos como responsable de la reserva."
            : "Agrega los datos de un acompañante."}
        </p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Progreso {progressLabel}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => updateForm({ firstName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Apellido</Label>
            <Input
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => updateForm({ lastName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de documento</Label>
            <select
              required
              value={form.documentType}
              onChange={(e) =>
                updateForm({
                  documentType: e.target.value as GuestStepValues["documentType"],
                })
              }
              className={selectClassName}
            >
              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {guestDocumentTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Número de documento</Label>
            <Input
              required
              value={form.documentNumber}
              onChange={(e) => updateForm({ documentNumber: e.target.value })}
            />
          </div>
          {isOwnerStep ? (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => updateForm({ email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono / WhatsApp</Label>
                <PhoneInput
                  required
                  value={form.phone ?? ""}
                  onChange={(phone) => updateForm({ phone })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Email (opcional)</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm({ email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono / WhatsApp (opcional)</Label>
                <PhoneInput
                  value={form.phone ?? ""}
                  onChange={(phone) => updateForm({ phone })}
                />
              </div>
            </>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Nacionalidad</Label>
            <Input
              value={nationalityQuery}
              onChange={(e) => setNationalityQuery(e.target.value)}
              placeholder="Buscar país…"
              autoComplete="off"
            />
            <select
              required
              value={form.nationality}
              onChange={(e) => updateForm({ nationality: e.target.value })}
              className={`${selectClassName} mt-2`}
            >
              {filteredNationalities.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Fecha de nacimiento</Label>
            <Input
              required
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) => updateForm({ dateOfBirth: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Sexo</Label>
            <select
              required
              value={form.sex}
              onChange={(e) =>
                updateForm({ sex: e.target.value as GuestStepValues["sex"] })
              }
              className={selectClassName}
            >
              {GUEST_SEX_CODES.map((code) => (
                <option key={code} value={code}>
                  {guestSexLabels[code]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Motivo principal de viaje</Label>
            <select
              required
              value={form.travelMotive}
              onChange={(e) =>
                updateForm({
                  travelMotive: e.target.value as GuestStepValues["travelMotive"],
                })
              }
              className={selectClassName}
            >
              {GUEST_TRAVEL_MOTIVE_CODES.map((code) => (
                <option key={code} value={code}>
                  {guestTravelMotiveLabels[code]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Ocupación / profesión</Label>
            <Input
              required
              value={form.occupation}
              onChange={(e) => updateForm({ occupation: e.target.value })}
              placeholder="Ej. Ingeniero, estudiante…"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <GuestPlaceFields
            idPrefix="residence"
            label="Residencia habitual"
            value={{
              country: form.residenceCountry,
              adminArea: form.residenceAdminArea,
              city: form.residenceCity,
            }}
            onChange={(next) =>
              updateForm({
                residenceCountry: next.country,
                residenceAdminArea: next.adminArea,
                residenceCity: next.city,
              })
            }
          />
          <GuestPlaceFields
            idPrefix="origin"
            label="Procedencia (desde dónde viajas)"
            value={{
              country: form.originCountry,
              adminArea: form.originAdminArea,
              city: form.originCity,
            }}
            onChange={(next) =>
              updateForm({
                originCountry: next.country,
                originAdminArea: next.adminArea,
                originCity: next.city,
              })
            }
          />
          <GuestPlaceFields
            idPrefix="destination"
            label="Destino (hacia dónde continúas / ciudad de estancia)"
            value={{
              country: form.destinationCountry,
              adminArea: form.destinationAdminArea,
              city: form.destinationCity,
            }}
            onChange={(next) =>
              updateForm({
                destinationCountry: next.country,
                destinationAdminArea: next.adminArea,
                destinationCity: next.city,
              })
            }
          />
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        {!isOwnerStep ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setStep("hub")}
            disabled={isPending}
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" className="h-11" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isOwnerStep ? "Guardar titular" : "Guardar huésped"}
        </Button>
      </div>
    </form>
  );
}
