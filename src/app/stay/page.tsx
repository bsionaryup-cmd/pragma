import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { StayPortalAccessForm } from "@/features/guests/components/stay-portal-access-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function StayPortalLookupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-pragma-soft sm:p-8">
        <GuestBrandMark />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          Mi estadía
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ingresa el código de tu reserva para ver el acceso, WiFi y la
          información esencial de tu alojamiento.
        </p>
        <StayPortalAccessForm />
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Disponible solo después de completar el registro de huéspedes y
          mientras tu reserva esté vigente.
        </p>
      </section>
    </main>
  );
}
