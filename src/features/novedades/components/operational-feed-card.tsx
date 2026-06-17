"use client";

import Link from "next/link";
import type {
  OperationalFeedCard,
  OperationalFeedKind,
} from "@/services/novedades/operational-feed.types";
import { cn } from "@/lib/utils";

type OperationalFeedCardViewProps = {
  card: OperationalFeedCard;
  nested?: boolean;
};

const KIND_STYLES: Record<
  OperationalFeedKind,
  { border: string; badge: string; badgeText: string }
> = {
  GUEST_MESSAGE: {
    border: "border-l-primary",
    badge: "bg-primary/10",
    badgeText: "text-primary",
  },
  MODIFICATION_REQUEST: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/10",
    badgeText: "text-amber-700 dark:text-amber-300",
  },
  MODIFICATION_APPROVED: {
    border: "border-l-pragma-aqua",
    badge: "bg-pragma-aqua/10",
    badgeText: "text-pragma-mid-blue dark:text-pragma-aqua",
  },
  RESERVATION_UPDATED: {
    border: "border-l-sky-500",
    badge: "bg-sky-500/10",
    badgeText: "text-sky-800 dark:text-sky-300",
  },
  STAY_EXTENDED: {
    border: "border-l-indigo-500",
    badge: "bg-indigo-500/10",
    badgeText: "text-indigo-800 dark:text-indigo-300",
  },
  PAYOUT_SENT: {
    border: "border-l-pragma-cyan",
    badge: "bg-pragma-cyan/10",
    badgeText: "text-teal-700 dark:text-teal-300",
  },
  NEW_RESERVATION: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/10",
    badgeText: "text-emerald-800 dark:text-emerald-300",
  },
  RESERVATION_CANCELLED: {
    border: "border-l-destructive",
    badge: "bg-destructive/10",
    badgeText: "text-destructive",
  },
  PAYMENT_CONFIRMED: {
    border: "border-l-teal-500",
    badge: "bg-teal-500/10",
    badgeText: "text-teal-800 dark:text-teal-300",
  },
  ALERT: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/10",
    badgeText: "text-amber-800 dark:text-amber-300",
  },
};

function buildMessageLine(card: OperationalFeedCard): string | null {
  if (card.summary) return card.summary;
  if (card.detailLines.length > 0) return card.detailLines.join(" · ");
  return null;
}

export function OperationalFeedCardView({
  card,
  nested = false,
}: OperationalFeedCardViewProps) {
  const styles = KIND_STYLES[card.kind];
  const reservationHref = card.reservationId
    ? `/reservations?reservation=${card.reservationId}`
    : null;
  const messageLine = buildMessageLine(card);

  const body = (
    <article
      className={cn(
        "group transition-colors",
        nested
          ? "rounded-md px-2 py-2 hover:bg-muted/30"
          : cn(
              "rounded-lg border border-border border-l-[3px] bg-card px-3 py-2.5 hover:bg-muted/30",
              styles.border,
            ),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
              styles.badge,
              styles.badgeText,
            )}
          >
            <span aria-hidden>{card.emoji}</span>
            {card.headline}
          </span>
          {card.priority === "attention" ? (
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Atención
            </span>
          ) : null}
          {card.amountLabel && card.kind !== "PAYOUT_SENT" ? (
            <span className="text-xs font-medium text-foreground">{card.amountLabel}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{card.relativeTime}</span>
      </div>

      {messageLine ? (
        <p
          className={cn(
            "line-clamp-2 leading-snug text-foreground/90",
            nested ? "mt-1.5 text-xs" : "mt-2 text-sm",
          )}
        >
          {messageLine}
        </p>
      ) : null}

      {!nested && card.amountLabel && card.kind === "PAYOUT_SENT" ? (
        <p className="mt-2 text-sm font-semibold text-foreground">{card.amountLabel}</p>
      ) : null}

      {!nested && reservationHref ? (
        <div className="mt-3">
          <Link
            href={reservationHref}
            className="inline-flex h-8 items-center text-xs font-medium text-primary hover:underline"
          >
            Ver reserva
          </Link>
        </div>
      ) : null}
    </article>
  );

  if (!nested && reservationHref) {
    return (
      <Link href={reservationHref} className="block no-underline">
        {body}
      </Link>
    );
  }

  return body;
}
