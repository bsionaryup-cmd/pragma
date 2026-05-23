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
import {
  documentTypes,
  type GuestStepValues,
} from "@/features/guests/schemas/guest-registration.schema";
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

function emptyGuestForm(): Omit<GuestStepValues, "token"> {
  return {
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    email: "",
    phone: "",
    nationality: "",
    dateOfBirth: "",
  };
}

function resolveInitialStep(
  reservation: GuestRegistrationReservation,
): WizardStep {
  if (reservation.completedAt) return "success";
  if (reservation.registeredCount > 0) return "hub";
  return "intro";
}

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
  const [form, setForm] = useState(emptyGuestForm);
  const [isPending, startTransition] = useTransition();

  const isOwnerStep = reservation.registeredCount === 0;
  const canAddMore = reservation.registeredCount < reservation.maxCapacity;
  const progressLabel = `${reservation.registeredCount} / ${reservation.maxCapacity}`;

  const registeredGuests = useMemo(
    () => reservation.guests.filter((guest) => guest.status !== "PENDING_REGISTRATION"),
    [reservation.guests],
  );

  function updateForm(patch: Partial<Omit<GuestStepValues, "token">>) {
    setForm((prev) => ({ ...prev, ...patch }));
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
    startTransition(async () => {
      const result = await completeGuestRegistrationAction({
        token: reservation.token,
        confirmAllGuests: true,
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
                de la reserva primero y luego agrega acompañantes uno por uno.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
          <p className="font-medium">Al finalizar te preguntaremos:</p>
          <p className="mt-1 text-muted-foreground">
            ¿Estos son todos los huéspedes que se hospedarán en esta reserva?
          </p>
        </div>

        <Button
          type="button"
          className="h-11 w-full"
          onClick={() => setStep("register")}
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
                Capacidad máxima de la propiedad: {reservation.maxCapacity}
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
                    {getGuestDocumentTypeLabel(guest.documentType)} · {guest.documentNumber}
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
              onClick={() => setStep("register")}
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
            ¿Estos son todos los huéspedes que se hospedarán?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Confirmas que registraste a todas las personas que ingresarán a la
            propiedad ({registeredGuests.length} de máximo{" "}
            {reservation.maxCapacity}).
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
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sí, confirmar registro
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
              value={form.firstName}
              onChange={(e) => updateForm({ firstName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Apellido</Label>
            <Input
              required
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
              className="h-10 w-full rounded-xl border border-input bg-white px-3.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-card"
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
          <div className="space-y-2">
            <Label>Nacionalidad (opcional)</Label>
            <Input
              value={form.nationality}
              onChange={(e) => updateForm({ nationality: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha de nacimiento (opcional)</Label>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateForm({ dateOfBirth: e.target.value })}
            />
          </div>
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
        <Button
          type="submit"
          className="h-11"
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isOwnerStep ? "Guardar titular" : "Guardar huésped"}
        </Button>
      </div>
    </form>
  );
}
