"use client";

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { submitGuestRegistrationAction } from "@/features/guests/actions/guest-registration.actions";
import {
  documentTypes,
  type GuestRegistrationValues,
} from "@/features/guests/schemas/guest-registration.schema";
import type { GuestRegistrationReservation } from "@/services/guests/guest-registration.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";

type GuestFormRow = GuestRegistrationValues["guests"][number];

const documentLabels: Record<(typeof documentTypes)[number], string> = {
  CC: "Cédula",
  CE: "Cédula extranjería",
  PASSPORT: "Pasaporte",
  DNI: "DNI",
  OTHER: "Otro",
};

function emptyGuest(): GuestFormRow {
  return {
    firstName: "",
    lastName: "",
    documentType: "CC",
    documentNumber: "",
    email: "",
    phone: "",
  };
}

export function GuestRegistrationForm({
  reservation,
}: {
  reservation: GuestRegistrationReservation;
}) {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(Boolean(reservation.completedAt));
  const [guests, setGuests] = useState<GuestFormRow[]>(() => {
    if (reservation.guests.length > 0) {
      return reservation.guests.map((guest) => ({
        firstName: guest.firstName,
        lastName: guest.lastName,
        documentType: documentTypes.includes(
          guest.documentType as (typeof documentTypes)[number],
        )
          ? (guest.documentType as (typeof documentTypes)[number])
          : "OTHER",
        documentNumber: guest.documentNumber,
        email: guest.email ?? "",
        phone: guest.phone ?? "",
      }));
    }
    return Array.from({ length: reservation.guestCount }, emptyGuest);
  });

  const filledCount = useMemo(
    () =>
      guests.filter(
        (guest, index) =>
          guest.firstName.trim() &&
          guest.lastName.trim() &&
          guest.documentNumber.trim() &&
          (index > 0 || (guest.email?.trim() && guest.phone?.trim())),
      ).length,
    [guests],
  );

  function updateGuest(index: number, patch: Partial<GuestFormRow>) {
    setCompleted(false);
    setGuests((prev) =>
      prev.map((guest, i) => (i === index ? { ...guest, ...patch } : guest)),
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await submitGuestRegistrationAction({
          token: reservation.token,
          guests,
        });
        setCompleted(true);
        toast.success("Registro de huéspedes completado");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo completar el registro",
        );
      }
    });
  }

  if (completed) {
    return (
      <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Registro completado
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tu información fue registrada correctamente en PRAGMA. El anfitrión ya
          podrá verla dentro de la reserva.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {filledCount} de {reservation.guestCount} huéspedes completos
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              El primer registro será el huésped principal y contacto de la
              reserva.
            </p>
          </div>
          {completed ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" />
              Registro enviado
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-sm font-semibold text-warning">
              <ShieldCheck className="h-4 w-4" />
              Pendiente
            </span>
          )}
        </div>
      </div>

      {guests.map((guest, index) => {
        const isPrimary = index === 0;
        return (
          <section
            key={index}
            className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Huésped {index + 1}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isPrimary
                    ? "Huésped principal y contacto de la reserva"
                    : "Acompañante"}
                </p>
              </div>
              {isPrimary ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  Principal
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  required
                  value={guest.firstName}
                  onChange={(e) =>
                    updateGuest(index, { firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  required
                  value={guest.lastName}
                  onChange={(e) =>
                    updateGuest(index, { lastName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <select
                  required
                  value={guest.documentType}
                  onChange={(e) =>
                    updateGuest(index, {
                      documentType: e.target
                        .value as GuestFormRow["documentType"],
                    })
                  }
                  className="h-10 w-full rounded-xl border border-input bg-white px-3.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-card"
                >
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {documentLabels[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Número de documento</Label>
                <Input
                  required
                  value={guest.documentNumber}
                  onChange={(e) =>
                    updateGuest(index, { documentNumber: e.target.value })
                  }
                />
              </div>
              {isPrimary ? (
                <>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      required
                      type="email"
                      value={guest.email}
                      onChange={(e) =>
                        updateGuest(index, { email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <PhoneInput
                      required
                      value={guest.phone ?? ""}
                      onChange={(phone) => updateGuest(index, { phone })}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </section>
        );
      })}

      <Button type="submit" className="h-11 w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Guardar registro de huéspedes
      </Button>
    </form>
  );
}
