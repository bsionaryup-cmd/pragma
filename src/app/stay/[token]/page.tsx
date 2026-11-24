import Link from "next/link";
import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { getGuestStayByToken } from "@/services/guests/guest-stay.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GuestStayPageProps = {
  params: Promise<{ token: string }>;
};

function statusLabel(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "Confirmada";
    case "CHECKED_IN":
      return "En estadía";
    case "CHECKOUT_TODAY":
      return "Salida hoy";
    case "CHECKED_OUT":
      return "Finalizada";
    case "CANCELLED":
      return "Cancelada";
    case "HOLD":
      return "En espera de pago";
    default:
      return status;
  }
}

export default async function GuestStayPage({ params }: GuestStayPageProps) {
  const { token } = await params;
  const result = await getGuestStayByToken(token);

  if (result.state === "registration_pending") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Completa el registro primero
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tu página de estadía estará disponible cuando registres a todos los
            huéspedes de la reserva.
          </p>
          <Link
            href={result.registrationUrl}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Ir al registro
          </Link>
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
            Enlace no disponible
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Este enlace de estadía no es válido o fue revocado. Usa el enlace
            seguro que recibiste al confirmar tu reserva o al completar el
            registro. No es posible consultar otras reservas con un código
            inventado.
          </p>
        </section>
      </main>
    );
  }

  const { stay } = result;
  const apartmentLabel = stay.unitNumber
    ? `${stay.propertyName} · ${stay.unitNumber}`
    : stay.propertyName;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            Tu estadía
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Información privada de tu reserva. Guarda este enlace; no lo
            compartas.
          </p>
        </header>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Código
              </dt>
              <dd className="mt-1 text-base font-semibold">
                {stay.reservationCode ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estado
              </dt>
              <dd className="mt-1 text-base font-semibold">
                {statusLabel(stay.status)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Entrada
              </dt>
              <dd className="mt-1 text-base">
                {stay.checkIn}
                {stay.checkInTime ? ` · ${stay.checkInTime}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Salida
              </dt>
              <dd className="mt-1 text-base">
                {stay.checkOut}
                {stay.checkOutTime ? ` · ${stay.checkOutTime}` : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Alojamiento
              </dt>
              <dd className="mt-1 text-base font-medium">{apartmentLabel}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">
                {stay.address}
                {stay.neighborhood ? `, ${stay.neighborhood}` : ""}
                {stay.city ? ` · ${stay.city}` : ""}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Registro de huéspedes
              </dt>
              <dd className="mt-1 text-sm">
                {stay.guestRegistrationCompleted
                  ? `Completado (${stay.registeredGuestCount} persona${stay.registeredGuestCount === 1 ? "" : "s"})`
                  : "Pendiente"}
              </dd>
              {stay.guestNames.length > 0 ? (
                <dd className="mt-1 text-sm text-muted-foreground">
                  {stay.guestNames.join(", ")}
                </dd>
              ) : null}
            </div>
          </dl>
        </section>

        {stay.accessInstructions ? (
          <section className="rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
            <h2 className="text-lg font-semibold">Instrucciones de llegada</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {stay.accessInstructions}
            </p>
          </section>
        ) : null}

        {stay.houseRules ? (
          <section className="rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
            <h2 className="text-lg font-semibold">Normas</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {stay.houseRules}
            </p>
          </section>
        ) : null}

        {stay.contactWhatsapp ? (
          <section className="rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
            <h2 className="text-lg font-semibold">Contacto</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              WhatsApp del alojamiento:{" "}
              <a
                className="font-medium text-primary underline-offset-2 hover:underline"
                href={`https://wa.me/${stay.contactWhatsapp.replace(/\D/g, "")}`}
                rel="noreferrer"
                target="_blank"
              >
                {stay.contactWhatsapp}
              </a>
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
