"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

const MAX_EVENTS = 5;

type GroupedFeedItem = {
  key: string;
  card: OperationalFeedCard;
  count: number;
};

function groupFeedCards(cards: OperationalFeedCard[]): GroupedFeedItem[] {
  const groups: GroupedFeedItem[] = [];

  for (const card of cards) {
    const key = `${card.kind}:${card.reservationId ?? card.id}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.count += 1;
      if (new Date(card.createdAt).getTime() > new Date(existing.card.createdAt).getTime()) {
        existing.card = card;
      }
      continue;
    }
    if (groups.length >= MAX_EVENTS) continue;
    groups.push({ key, card, count: 1 });
  }

  return groups;
}

type OperationsFeedSectionProps = {
  cards: OperationalFeedCard[];
};

export function OperationsFeedSection({ cards }: OperationsFeedSectionProps) {
  const { t } = useI18n();
  const router = useRouter();
  const grouped = useMemo(() => groupFeedCards(cards), [cards]);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-pragma-soft">
      <div className="border-b border-border/60 px-5 py-4 sm:px-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {t("dashboard.sections.activity")}
        </h2>
      </div>

      {grouped.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
          {t("common.noRecordsDetail")}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {grouped.map(({ key, card, count }) => {
            const href = card.reservationId
              ? `/novedades?reservation=${card.reservationId}`
              : "/novedades";

            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => router.push(href)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/15 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {card.narrative}
                      {count > 1 ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ×{count}
                        </span>
                      ) : null}
                    </p>
                    {card.propertyLabel || card.relativeTime ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[card.propertyLabel, card.relativeTime].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-border/60 px-5 py-3 sm:px-6">
        <Link
          href="/novedades"
          className="inline-flex text-sm font-medium text-pragma-electric transition-colors hover:underline"
        >
          {t("dashboard.activity.viewAllActivity")}
        </Link>
      </div>
    </section>
  );
}
