"use client";

import Link from "next/link";
import { toast } from "sonner";
import type {
  OperationalFeedCard,
  OperationalFeedKind,
} from "@/services/novedades/operational-feed.types";
import { cn } from "@/lib/utils";

type OperationalFeedCardViewProps = {
  card: OperationalFeedCard;
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
  PAYOUT_SENT: {
    border: "border-l-pragma-cyan",
    badge: "bg-pragma-cyan/10",
    badgeText: "text-teal-700 dark:text-teal-300",
  },
  NEW_RESERVATION: {
    border: "border-l-primary",
    badge: "bg-primary/10",
    badgeText: "text-primary",
  },
  UPCOMING_CHECKIN: {
    border: "border-l-pragma-aqua",
    badge: "bg-pragma-aqua/10",
    badgeText: "text-pragma-mid-blue dark:text-pragma-aqua",
  },
  UPCOMING_CHECKOUT: {
    border: "border-l-pragma-mid-blue",
    badge: "bg-primary/10",
    badgeText: "text-primary",
  },
  RESERVATION_CANCELLED: {
    border: "border-l-destructive",
    badge: "bg-destructive/10",
    badgeText: "text-destructive",
  },
  GUEST_REGISTRATION_ADMIN_SENT: {
    border: "border-l-teal-500",
    badge: "bg-teal-500/10",
    badgeText: "text-teal-800 dark:text-teal-300",
  },
  GUEST_REGISTRATION_ADMIN_FAILED: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/10",
    badgeText: "text-amber-800 dark:text-amber-300",
  },
};

function isSuggestedAction(card: OperationalFeedCard): boolean {
  return card.id.startsWith("quick:");
}

function buildMetaLine(card: OperationalFeedCard): string | null {
  const parts: string[] = [];
  if (card.propertyLabel) parts.push(card.propertyLabel);
  if (card.dateRangeLabel) parts.push(card.dateRangeLabel);
  if (card.confirmationCode) parts.push(card.confirmationCode);
  if (card.amountLabel && card.kind === "PAYOUT_SENT") {
    parts.push(card.amountLabel);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildMessageLine(card: OperationalFeedCard): string | null {
  if (card.summary) return card.summary;
  if (card.detailLines.length > 0) return card.detailLines.join(" · ");
  return null;
}

export function OperationalFeedCardView({ card }: OperationalFeedCardViewProps) {
  const styles = KIND_STYLES[card.kind];
  const suggested = isSuggestedAction(card);
  const reservationHref = card.reservationId
    ? `/reservations?reservation=${card.reservationId}`
    : null;
  const metaLine = buildMetaLine(card);
  const messageLine = buildMessageLine(card);
  const guestLabel =
    card.guestName && card.kind !== "PAYOUT_SENT"
      ? card.guestName
      : card.kind === "PAYOUT_SENT" && card.amountLabel
        ? card.amountLabel
        : "Sin huésped";

  const body = (
    <article
      className={cn(
        "group rounded-lg border border-border border-l-[3px] bg-card px-3 py-2.5 transition-colors",
        "hover:bg-muted/30",
        styles.border,
        suggested && "border-dashed ring-1 ring-primary/15",
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
          {suggested ? (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Acción sugerida
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{card.relativeTime}</span>
      </div>

      <p className="mt-2 text-sm font-semibold text-foreground">{guestLabel}</p>

      {metaLine ? (
        <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p>
      ) : null}

      {messageLine ? (
        <p className="mt-2 line-clamp-2 text-sm leading-snug text-foreground/90">
          {messageLine}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {card.quickActionMessage ? (
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted/50"
            onClick={async () => {
              await navigator.clipboard.writeText(card.quickActionMessage ?? "");
              toast.success("Mensaje copiado");
            }}
          >
            {card.quickActionLabel ?? "Copiar mensaje"}
          </button>
        ) : null}
        {reservationHref ? (
          <Link
            href={reservationHref}
            className="inline-flex h-8 items-center text-xs font-medium text-primary hover:underline"
          >
            Ver reserva
          </Link>
        ) : null}
      </div>
    </article>
  );

  if (reservationHref && !card.quickActionMessage) {
    return (
      <Link href={reservationHref} className="block no-underline">
        {body}
      </Link>
    );
  }

  return body;
}
