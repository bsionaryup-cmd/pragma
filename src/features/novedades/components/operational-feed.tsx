"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  OperationalFeedCard,
  OperationalFeedReservationGroup,
  OperationalFeedView,
} from "@/services/novedades/operational-feed.types";
import { OperationalFeedTimelineEvent } from "@/features/novedades/components/operational-feed-timeline-event";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type OperationalFeedProps = {
  feed: OperationalFeedView;
};

const VISIBLE_EVENTS = 4;

function GroupStatusBadge({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function ReservationActivityGroup({
  group,
}: {
  group: OperationalFeedReservationGroup;
}) {
  const [expanded, setExpanded] = useState(false);
  const href = `/reservations?reservation=${group.reservationId}`;
  const visibleEvents = expanded
    ? group.events
    : group.events.slice(0, VISIBLE_EVENTS);
  const hiddenCount = group.events.length - visibleEvents.length;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-pragma-soft",
        group.attentionCount > 0 && "ring-1 ring-amber-500/25",
      )}
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            group.attentionCount > 0
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
              : "bg-primary/10 text-primary",
          )}
          aria-hidden
        >
          {group.guestInitials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={href}
              className="truncate text-base font-semibold text-foreground no-underline hover:text-primary"
            >
              {group.guestName ?? "Huésped sin nombre"}
            </Link>
            <GroupStatusBadge label={group.statusLabel} />
            {group.attentionCount > 0 ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                {group.attentionCount} pendiente{group.attentionCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {[group.propertyLabel, group.dateRangeLabel, group.confirmationCode]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {group.latestNarrative ? (
            <p className="mt-2 line-clamp-2 text-sm text-foreground/90">
              {group.latestNarrative}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <time className="text-xs text-muted-foreground">
            {group.events[0]?.relativeTime ?? ""}
          </time>
          <Link
            href={href}
            className="mt-2 block text-xs font-medium text-primary hover:underline"
          >
            Ver reserva
          </Link>
        </div>
      </div>

      <ol className="relative px-4 py-3">
        <div
          className="absolute bottom-4 left-[1.65rem] top-4 w-px bg-border"
          aria-hidden
        />
        {visibleEvents.map((event, index) => (
          <OperationalFeedTimelineEvent
            key={event.id}
            card={event}
            isLast={index === visibleEvents.length - 1}
          />
        ))}
      </ol>

      {hiddenCount > 0 ? (
        <div className="border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {expanded
              ? "Ver menos"
              : `Ver ${hiddenCount} evento${hiddenCount === 1 ? "" : "s"} más`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function UnlinkedSection({ cards }: { cards: OperationalFeedCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section aria-label="Pagos sin reserva vinculada" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Pagos sin reserva
      </h2>
      {cards.map((card) => (
        <div
          key={card.id}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
        >
          {card.narrative}
        </div>
      ))}
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
        title="Sin actividad por ahora"
        description="Aquí verás el historial de cada reserva: confirmaciones, cambios, pagos, mensajes del huésped y alertas importantes."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {feed.groups.map((group) => (
        <ReservationActivityGroup key={group.reservationId} group={group} />
      ))}
      <UnlinkedSection cards={feed.unlinked} />
    </div>
  );
}
