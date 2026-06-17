"use client";

import Link from "next/link";
import type {
  OperationalFeedCard,
  OperationalFeedKind,
  OperationalFeedReservationGroup,
  OperationalFeedView,
} from "@/services/novedades/operational-feed.types";
import { OperationalFeedCardView } from "@/features/novedades/components/operational-feed-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type OperationalFeedProps = {
  feed: OperationalFeedView;
};

function buildGroupMeta(group: OperationalFeedReservationGroup): string | null {
  const parts: string[] = [];
  if (group.propertyLabel) parts.push(group.propertyLabel);
  if (group.dateRangeLabel) parts.push(group.dateRangeLabel);
  if (group.confirmationCode) parts.push(group.confirmationCode);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function ReservationFeedGroup({ group }: { group: OperationalFeedReservationGroup }) {
  const meta = buildGroupMeta(group);
  const href = `/reservations?reservation=${group.reservationId}`;

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-pragma-soft",
        group.attentionCount > 0 && "ring-1 ring-amber-500/20",
      )}
    >
      <Link
        href={href}
        className="block border-b border-border px-4 py-3 no-underline transition-colors hover:bg-muted/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {group.guestName ?? "Reserva sin huésped"}
            </h3>
            {meta ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {group.attentionCount > 0 ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                {group.attentionCount} pendiente{group.attentionCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {group.events[0]?.relativeTime ?? ""}
            </span>
          </div>
        </div>
      </Link>

      <ol className="divide-y divide-border/70 px-2 py-1">
        {group.events.map((event) => (
          <li key={event.id} className="list-none py-1">
            <OperationalFeedCardView card={event} nested />
          </li>
        ))}
      </ol>
    </section>
  );
}

function UnlinkedSection({ cards }: { cards: OperationalFeedCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section aria-label="Eventos sin reserva vinculada">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Sin reserva vinculada
      </h2>
      <div className="flex flex-col gap-2">
        {cards.map((card) => (
          <OperationalFeedCardView key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export function OperationalFeed({ feed }: OperationalFeedProps) {
  const totalEvents =
    feed.groups.reduce((count, group) => count + group.events.length, 0) +
    feed.unlinked.length;

  if (totalEvents === 0) {
    return (
      <EmptyState
        title="Sin novedades por ahora"
        description="Aquí verás el historial de cada reserva: confirmaciones, cambios, pagos, mensajes importantes y alertas que requieran tu atención."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {feed.groups.map((group) => (
        <ReservationFeedGroup key={group.reservationId} group={group} />
      ))}
      <UnlinkedSection cards={feed.unlinked} />
    </div>
  );
}
