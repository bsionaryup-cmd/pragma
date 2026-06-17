"use client";

import type {
  OperationalFeedCard,
  OperationalFeedKind,
} from "@/services/novedades/operational-feed.types";
import { cn } from "@/lib/utils";

type OperationalFeedTimelineEventProps = {
  card: OperationalFeedCard;
  isLast?: boolean;
};

const KIND_DOT: Record<OperationalFeedKind, string> = {
  GUEST_MESSAGE: "bg-primary",
  MODIFICATION_REQUEST: "bg-amber-500",
  MODIFICATION_APPROVED: "bg-sky-500",
  RESERVATION_UPDATED: "bg-sky-500",
  STAY_EXTENDED: "bg-indigo-500",
  PAYOUT_SENT: "bg-teal-500",
  NEW_RESERVATION: "bg-emerald-500",
  RESERVATION_CANCELLED: "bg-destructive",
  PAYMENT_CONFIRMED: "bg-teal-600",
  ALERT: "bg-amber-500",
};

export function OperationalFeedTimelineEvent({
  card,
  isLast = false,
}: OperationalFeedTimelineEventProps) {
  return (
    <li
      className={cn(
        "relative list-none pl-8",
        isLast ? "pb-0" : "pb-4",
      )}
    >
      <span
        className={cn(
          "absolute left-2 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
          KIND_DOT[card.kind],
        )}
        aria-hidden
      />

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "text-sm leading-snug text-foreground",
              card.priority === "attention" && "font-medium",
            )}
          >
            {card.narrative}
          </p>
          <time className="shrink-0 text-[11px] text-muted-foreground">
            {card.relativeTime}
          </time>
        </div>

        <p className="mt-1 text-[11px] text-muted-foreground">
          {card.headline}
          {card.amountLabel && card.kind !== "PAYOUT_SENT"
            ? ` · ${card.amountLabel}`
            : null}
        </p>
      </div>
    </li>
  );
}

/** Tarjeta suelta fuera de un grupo (p. ej. pagos huérfanos). */
export function OperationalFeedCardView({
  card,
}: {
  card: OperationalFeedCard;
}) {
  return (
    <article className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-foreground">{card.narrative}</p>
      <p className="mt-1 text-xs text-muted-foreground">{card.relativeTime}</p>
    </article>
  );
}
