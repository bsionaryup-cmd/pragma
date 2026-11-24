import { BookingPlatform } from "@prisma/client";
import { redirect } from "next/navigation";
import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { GuestRegistrationForm } from "@/features/guests/components/guest-registration-form";
import { getGuestRegistrationLookupResult } from "@/services/guests/guest-registration.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GuestRegistrationPageProps = {
  params: Promise<{ token: string }>;
};

export default async function GuestRegistrationPage({
  params,
}: GuestRegistrationPageProps) {
  const { token } = await params;
  const result = await getGuestRegistrationLookupResult(token);

  if (result.state === "completed") {
    redirect(`/stay/${encodeURIComponent(token)}`);
  }

  if (result.state !== "valid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Link no disponible
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Este enlace de registro no existe o fue revocado. Si reservaste por
            la web, vuelve a abrir el enlace que te mostró el sitio al confirmar.
            Si reservaste por Airbnb, solicita un nuevo link al anfitrión.
          </p>
        </section>
      </main>
    );
  }

  const { reservation } = result;
  const isWebDirect = reservation.platform === BookingPlatform.DIRECT;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            Registro de huéspedes
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Completa los datos de todas las personas que ingresarán a la
            propiedad. Este registro está vinculado a tu reserva
            {reservation.reservationCode
              ? ` (${reservation.reservationCode})`
              : ""}
            .
          </p>

          <ol className="mt-4 list-decimal space-y-2 rounded-2xl bg-muted/50 p-4 pl-8 text-sm leading-6 text-muted-foreground">
            <li>
              Registra primero al titular de la reserva (nombre, contacto y
              documento).
            </li>
            <li>
              Agrega a cada acompañante con su tipo y número de documento.
            </li>
            <li>
              Revisa que el total de personas no supere la capacidad de la
              reserva ({reservation.maxCapacity}).
            </li>
            <li>
              Finaliza el registro. El código de acceso se genera solo cuando se
              cumplan los requisitos del proceso (registro completo y reglas de
              la cerradura).
            </li>
          </ol>

          {isWebDirect ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Reservaste desde la página web: no necesitas esperar un correo o
              WhatsApp. Completa este formulario y listo.
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Propiedad
              </p>
              <p className="mt-1 font-medium">{reservation.propertyName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Check-in
              </p>
              <p className="mt-1 font-medium">{reservation.checkIn}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Check-out
              </p>
              <p className="mt-1 font-medium">{reservation.checkOut}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Capacidad máxima
              </p>
              <p className="mt-1 font-medium">
                {reservation.maxCapacity} huésped
                {reservation.maxCapacity === 1 ? "" : "es"}
              </p>
            </div>
          </div>
          {reservation.registeredCount > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Progreso actual: {reservation.registeredCount} /{" "}
              {reservation.maxCapacity} huéspedes registrados
            </p>
          ) : null}
        </header>

        <GuestRegistrationForm reservation={reservation} />
      </div>
    </main>
  );
}
