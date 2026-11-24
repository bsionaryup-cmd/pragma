import { formatDate } from "@/lib/helpers/date";
import type { GuestRegistrationReservation } from "@/services/guests/guest-registration.service";

type GuestRegistrationReservationHeaderProps = {
  reservation: GuestRegistrationReservation;
};

/**
 * Public-safe confirmation header. Only authorized fields:
 * holder name, property, Airbnb code, check-in, check-out.
 */
export function GuestRegistrationReservationHeader({
  reservation,
}: GuestRegistrationReservationHeaderProps) {
  const welcome = reservation.holderDisplayName
    ? `Bienvenido, ${reservation.holderDisplayName}.`
    : "Bienvenido.";

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {welcome}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Encontramos correctamente tu reserva.
        </p>
      </div>

      <dl className="grid gap-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Propiedad
          </dt>
          <dd className="mt-1 font-medium">{reservation.propertyName}</dd>
        </div>
        {reservation.reservationCode ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Código Airbnb
            </dt>
            <dd className="mt-1 font-medium tracking-wide">
              {reservation.reservationCode}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Check-in
          </dt>
          <dd className="mt-1 font-medium">{formatDate(reservation.checkIn)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Check-out
          </dt>
          <dd className="mt-1 font-medium">
            {formatDate(reservation.checkOut)}
          </dd>
        </div>
      </dl>

      <p className="text-sm leading-6 text-muted-foreground">
        Ahora completa el registro de todas las personas que se hospedarán.
      </p>

      {reservation.registeredCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          Progreso actual: {reservation.registeredCount} /{" "}
          {reservation.maxCapacity} huésped
          {reservation.maxCapacity === 1 ? "" : "es"} registrados
        </p>
      ) : null}
    </div>
  );
}
