import Link from "next/link";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OperationalFeedCardViewProps = {
  card: OperationalFeedCard;
};

export function OperationalFeedCardView({ card }: OperationalFeedCardViewProps) {
  const reservationHref = card.reservationId
    ? `/reservations?reservation=${card.reservationId}`
    : null;
  const propertyHref = card.propertyId ? `/properties/${card.propertyId}` : null;

  const showPropertyFooter =
    card.propertyLabel &&
    card.kind !== "PAYOUT_SENT" &&
    !card.detailLines.some((line) => line.startsWith("Propiedad:"));

  const showReservationFooter =
    card.dateRangeLabel && card.kind !== "PAYOUT_SENT" && card.kind !== "GUEST_MESSAGE";

  return (
    <article
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 shadow-pragma-soft transition-colors",
        "hover:border-pragma-cyan/30 hover:bg-card/95",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pragma-soft-cyan text-lg"
          aria-hidden
        >
          {card.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{card.headline}</p>
              {card.guestName && card.kind !== "PAYOUT_SENT" ? (
                <p className="mt-0.5 text-sm font-medium text-foreground/90">
                  {card.guestName}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">{card.relativeTime}</p>
          </div>

          {card.dateRangeLabel &&
          (card.kind === "NEW_RESERVATION" ||
            card.kind === "GUEST_MESSAGE" ||
            card.kind === "UPCOMING_CHECKIN" ||
            card.kind === "UPCOMING_CHECKOUT") ? (
            <p className="mt-2 text-sm text-foreground/85">{card.dateRangeLabel}</p>
          ) : null}

          {card.summary ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{card.summary}</p>
          ) : null}

          {card.amountLabel ? (
            <div className="mt-2">
              {card.kind === "NEW_RESERVATION" ? (
                <p className="text-xs font-medium text-muted-foreground">Ingreso esperado</p>
              ) : null}
              <p className="text-base font-semibold tabular-nums text-foreground">
                {card.amountLabel}
              </p>
            </div>
          ) : null}

          {card.detailLines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {card.detailLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {showReservationFooter ? (
              <span>
                <span className="font-medium text-foreground/70">Reserva:</span>{" "}
                {card.dateRangeLabel}
              </span>
            ) : null}
            {showPropertyFooter ? (
              <span>
                <span className="font-medium text-foreground/70">Propiedad:</span>{" "}
                {card.propertyLabel}
              </span>
            ) : null}
            {card.confirmationCode ? (
              <span>
                <span className="font-medium text-foreground/70">Código:</span>{" "}
                {card.confirmationCode}
              </span>
            ) : null}
          </div>

          {reservationHref || propertyHref ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {reservationHref ? (
                <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                  <Link href={reservationHref}>Ver reserva</Link>
                </Button>
              ) : null}
              {propertyHref ? (
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link href={propertyHref}>Ver propiedad</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
