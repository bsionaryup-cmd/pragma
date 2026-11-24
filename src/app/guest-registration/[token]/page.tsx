import { BookingPlatform } from "@prisma/client";
import { redirect } from "next/navigation";
import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { GuestRegistrationForm } from "@/features/guests/components/guest-registration-form";
import { GuestRegistrationReservationHeader } from "@/features/guests/components/guest-registration-reservation-header";
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Registro completado
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            La información de huéspedes ya fue registrada correctamente.
          </p>
          {result.stayPortalUrl ? (
            <a
              href={result.stayPortalUrl}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Ir a mi Estadía
            </a>
          ) : (
            <a
              href="/stay"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground"
            >
              Consultar mi estadía
            </a>
          )}
        </section>
      </main>
    );
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
          <GuestRegistrationReservationHeader reservation={reservation} />
          {isWebDirect ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Reservaste desde la página web: no necesitas esperar un correo o
              WhatsApp. Completa este formulario y listo.
            </p>
          ) : null}
        </header>

        <GuestRegistrationForm reservation={reservation} />
      </div>
    </main>
  );
}
