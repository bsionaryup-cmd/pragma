import { Bookmark, CalendarDays, UserRound } from "lucide-react";

type ReservationSummaryProps = {
  checkInLabel: string | null;
  checkOutLabel: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  guestName: string | null;
  reservationCode: string | null;
  /** embedded = grid inside property header (mockup) */
  variant?: "card" | "embedded";
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
  variant = "embedded",
}: ReservationSummaryProps) {
  const checkInClock = formatClock(checkInTime);
  const checkOutClock = formatClock(checkOutTime);

  const items = [
    {
      key: "check-in",
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      label: "Entrada",
      value: checkInLabel,
      hint: checkInClock ? `Desde ${checkInClock}` : null,
    },
    {
      key: "check-out",
      icon: <CalendarDays className="h-3.5 w-3.5" />,
      label: "Salida",
      value: checkOutLabel,
      hint: checkOutClock ? `Hasta ${checkOutClock}` : null,
    },
    {
      key: "guest",
      icon: <UserRound className="h-3.5 w-3.5" />,
      label: "Huésped",
      value: guestName,
      hint: null as string | null,
    },
    {
      key: "code",
      icon: <Bookmark className="h-3.5 w-3.5" />,
      label: "Reserva",
      value: reservationCode,
      hint: null as string | null,
    },
  ].filter((item) => item.value);

  if (items.length === 0) return null;

  const grid = (
    <dl className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-primary" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold text-foreground">
            {item.value}
          </dd>
          {item.hint ? (
            <p className="text-xs text-muted-foreground">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );

  if (variant === "embedded") return grid;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5">
      {grid}
    </section>
  );
}
