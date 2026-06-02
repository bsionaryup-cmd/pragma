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
    border: "border-l-pragma-electric",
    badge: "bg-pragma-soft-cyan",
    badgeText: "text-pragma-electric",
  },
  MODIFICATION_REQUEST: {
    border: "border-l-amber-500",
    badge: "bg-amber-50",
    badgeText: "text-amber-700",
  },
  MODIFICATION_APPROVED: {
    border: "border-l-pragma-aqua",
    badge: "bg-pragma-light-blue",
    badgeText: "text-pragma-mid-blue",
  },
  PAYOUT_SENT: {
    border: "border-l-pragma-cyan",
    badge: "bg-pragma-soft-cyan",
    badgeText: "text-teal-700",
  },
  NEW_RESERVATION: {
    border: "border-l-pragma-electric",
    badge: "bg-pragma-soft-cyan",
    badgeText: "text-pragma-electric",
  },
  UPCOMING_CHECKIN: {
    border: "border-l-pragma-aqua",
    badge: "bg-pragma-light-blue",
    badgeText: "text-pragma-mid-blue",
  },
  UPCOMING_CHECKOUT: {
    border: "border-l-pragma-mid-blue",
    badge: "bg-pragma-light-blue",
    badgeText: "text-pragma-electric",
  },
  RESERVATION_CANCELLED: {
    border: "border-l-red-500",
    badge: "bg-red-50",
    badgeText: "text-red-700",
  },
  GUEST_REGISTRATION_ADMIN_SENT: {
    border: "border-l-teal-500",
    badge: "bg-teal-50",
    badgeText: "text-teal-800",
  },
  GUEST_REGISTRATION_ADMIN_FAILED: {
    border: "border-l-amber-500",
    badge: "bg-amber-50",
    badgeText: "text-amber-800",
  },
};

function buildContextLine(card: OperationalFeedCard): string | null {
  const parts: string[] = [];

  if (card.guestName && card.kind !== "PAYOUT_SENT") {
    parts.push(card.guestName);
  }

  if (card.propertyLabel) {
    parts.push(card.propertyLabel);
  }

  if (card.dateRangeLabel) {
    parts.push(card.dateRangeLabel);
  }

  if (card.confirmationCode) {
    parts.push(card.confirmationCode);
  }

  if (card.amountLabel) {
    parts.push(card.amountLabel);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildSecondaryLine(card: OperationalFeedCard): string | null {
  if (card.summary) return card.summary;
  if (card.detailLines.length > 0) return card.detailLines.join(" · ");
  return null;
}

export function OperationalFeedCardView({ card }: OperationalFeedCardViewProps) {
  const styles = KIND_STYLES[card.kind];
  const reservationHref = card.reservationId
    ? `/reservations?reservation=${card.reservationId}`
    : null;
  const contextLine = buildContextLine(card);
  const secondaryLine = buildSecondaryLine(card);

  const body = (
    <article
      className={cn(
        "group rounded border border-pragma-border/70 border-l-2 bg-white px-2 py-1.5 transition-colors",
        "hover:bg-pragma-soft-gray/35",
        styles.border,
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className={cn(
            "mt-px inline-flex shrink-0 items-center rounded px-1 py-px text-[9px] leading-none",
            styles.badge,
            styles.badgeText,
          )}
          title={card.headline}
        >
          {card.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] leading-tight text-pragma-black">
            <span className="font-semibold">{card.headline}</span>
            {contextLine ? (
              <span className="font-normal text-pragma-mid-gray"> · {contextLine}</span>
            ) : null}
          </p>
          {secondaryLine ? (
            <p className="mt-0.5 truncate text-[10px] leading-tight text-pragma-mid-gray">
              {secondaryLine}
            </p>
          ) : null}
        </div>

        <span className="shrink-0 pt-px text-[10px] leading-tight text-pragma-mid-gray">
          {card.relativeTime}
        </span>
      </div>

      {card.quickActionMessage ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center rounded border border-border/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/40"
            onClick={async () => {
              await navigator.clipboard.writeText(card.quickActionMessage ?? "");
              toast.success("Mensaje copiado");
            }}
          >
            {card.quickActionLabel ?? "Copiar mensaje"}
          </button>
          {reservationHref ? (
            <Link
              href={reservationHref}
              className="text-[10px] font-medium text-pragma-electric hover:underline"
            >
              Ver reserva
            </Link>
          ) : null}
        </div>
      ) : null}
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
