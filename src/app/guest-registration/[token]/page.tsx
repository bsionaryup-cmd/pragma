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
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            PRAGMA
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Registro completado
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            La información de huéspedes ya fue registrada correctamente. Gracias.
          </p>
        </section>
      </main>
    );
  }

  if (result.state !== "valid") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            PRAGMA
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Link no disponible
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Este enlace de registro no existe o fue revocado. Solicita un nuevo
            link al anfitrión desde Airbnb.
          </p>
        </section>
      </main>
    );
  }

  const { reservation } = result;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            PRAGMA
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Registro de huéspedes
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Completa los datos de todas las personas que ingresarán a la
            propiedad. Este registro está vinculado a tu reserva.
          </p>
          <div className="mt-5 grid gap-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-3">
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
          </div>
        </header>

        <GuestRegistrationForm reservation={reservation} />
      </div>
    </main>
  );
}
