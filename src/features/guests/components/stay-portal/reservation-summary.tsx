import { Bookmark, CalendarDays, UserRound } from "lucide-react";

type ReservationSummaryProps = {
  checkInLabel: string | null;
  checkOutLabel: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  guestName: string | null;
  reservationCode: string | null;
};

function formatClock(time: string | null): string | null {
  if (!time?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time.trim();
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time.trim();
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\u00a0|\u202f/g, " ");
}

export function ReservationSummary({
  checkInLabel,
  checkOutLabel,
  checkInTime,
  checkOutTime,
  guestName,
  reservationCode,
}: ReservationSummaryProps) {
  const items = [
    {
      key: "check-in",
      icon: <CalendarDays className="h-4 w-4" />,
      label: "Entrada",
      value: checkInLabel,
      hint: checkInTime ? `Desde ${formatClock(checkInTime)}` : null,
    },
    {
      key: "check-out",
      icon: <CalendarDays className="h-4 w-4" />,
      label: "Salida",
      value: checkOutLabel,
      hint: checkOutTime ? `Hasta ${formatClock(checkOutTime)}` : null,
    },
    {
      key: "guest",
      icon: <UserRound className="h-4 w-4" />,
      label: "Huésped",
      value: guestName,
      hint: null as string | null,
    },
    {
      key: "code",
      icon: <Bookmark className="h-4 w-4" />,
      label: "Reserva",
      value: reservationCode,
      hint: null as string | null,
    },
  ].filter((item) => item.value);

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="stay-reservation-summary-title"
      className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5"
    >
      <h2
        id="stay-reservation-summary-title"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Información de la reserva
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
          >
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="truncate text-sm font-semibold text-foreground">
                {item.value}
              </dd>
              {item.hint ? (
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
