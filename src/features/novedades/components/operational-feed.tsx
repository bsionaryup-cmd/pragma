"use client";

import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import { OperationalFeedCardView } from "@/features/novedades/components/operational-feed-card";
import { EmptyState } from "@/components/ui/empty-state";

type OperationalFeedProps = {
  cards: OperationalFeedCard[];
};

type FeedSection = {
  id: "today" | "yesterday" | "earlier";
  label: string;
  cards: OperationalFeedCard[];
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function groupCardsByDay(cards: OperationalFeedCard[]): FeedSection[] {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const sections: FeedSection[] = [
    { id: "today", label: "Hoy", cards: [] },
    { id: "yesterday", label: "Ayer", cards: [] },
    { id: "earlier", label: "Anteriores", cards: [] },
  ];

  for (const card of cards) {
    const created = new Date(card.createdAt);
    const day = startOfLocalDay(created);

    if (day.getTime() === todayStart.getTime()) {
      sections[0].cards.push(card);
    } else if (day.getTime() === yesterdayStart.getTime()) {
      sections[1].cards.push(card);
    } else {
      sections[2].cards.push(card);
    }
  }

  return sections.filter((section) => section.cards.length > 0);
}

export function OperationalFeed({ cards }: OperationalFeedProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        title="Sin novedades por ahora"
        description="Aquí aparecen reservas confirmadas, pagos, mensajes de huéspedes y cambios en reservas cuando Airbnb envíe el correo a tu bandeja conectada."
      />
    );
  }

  const sections = groupCardsByDay(cards);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {sections.map((section) => (
        <section key={section.id} aria-label={section.label}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {section.label}
          </h2>
          <div className="flex flex-col gap-2">
            {section.cards.map((card) => (
              <OperationalFeedCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
