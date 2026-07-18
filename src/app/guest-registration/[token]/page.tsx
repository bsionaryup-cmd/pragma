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
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
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
          <GuestBrandMark />
          <GuestRegistrationReservationHeader reservation={reservation} />
        </header>

        <GuestRegistrationForm reservation={reservation} />
      </div>
    </main>
  );
}
